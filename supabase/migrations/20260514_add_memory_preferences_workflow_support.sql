create extension if not exists vector;

insert into assistant.preferences (key, value)
values
  (
    'parser_context',
    '{
      "default_currency": "AED",
      "category_defaults": {
        "Costa": "Food",
        "Starbucks": "Food",
        "Carrefour": "Groceries",
        "Lulu": "Groceries",
        "Dubai Taxi": "Transport",
        "Careem": "Transport",
        "DEWA": "Bills",
        "Etisalat": "Bills",
        "Du": "Bills"
      },
      "card_aliases": {
        "ADCB Visa": "ADCB Credit",
        "ADCB debit": "ADCB Debit",
        "ENBD debit": "ENBD Debit",
        "DIB debit": "DIB Debit",
        "RAK debit": "RAK Debit",
        "CBD debit": "CBD Debit",
        "TABBY": "TABBY Credit"
      }
    }'::jsonb
  )
on conflict (key) do update
set value = assistant.preferences.value || excluded.value,
    updated_at = now();

create or replace function public.assistant_match_memories(
  query_embedding vector(1536),
  match_threshold double precision default 0.2,
  match_count integer default 8,
  match_memory_type text default null
)
returns table (
  id uuid,
  memory_type text,
  content text,
  metadata jsonb,
  similarity double precision,
  created_at timestamptz
)
language sql
stable
as $$
  select
    memories.id,
    memories.memory_type,
    memories.content,
    memories.metadata,
    1 - (memories.embedding <=> query_embedding) as similarity,
    memories.created_at
  from assistant.memories
  where memories.embedding is not null
    and (match_memory_type is null or memories.memory_type = match_memory_type)
    and 1 - (memories.embedding <=> query_embedding) >= match_threshold
  order by memories.embedding <=> query_embedding asc
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.assistant_match_memories(vector(1536), double precision, integer, text) from public;
revoke all on function public.assistant_match_memories(vector(1536), double precision, integer, text) from anon;
revoke all on function public.assistant_match_memories(vector(1536), double precision, integer, text) from authenticated;
grant execute on function public.assistant_match_memories(vector(1536), double precision, integer, text) to service_role;
