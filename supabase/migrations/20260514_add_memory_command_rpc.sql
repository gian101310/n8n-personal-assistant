comment on table assistant.memories is
  'Long-term assistant memories and natural-language notes. Users can say things like "remember Costa is Food" or "remind me everything I told you as notes to remember"; Telegram workflows store and recall these rows.';

comment on column assistant.memories.memory_type is
  'Memory category such as note, preference, merchant_category, card_preference, or correction.';

comment on column assistant.memories.content is
  'Plain-language memory text. Keep this readable because recall commands send it back to the user.';

comment on column assistant.memories.embedding is
  '1536-dimension OpenAI text-embedding-3-small vector for semantic recall and matching.';

create or replace function public.assistant_create_memory(
  memory_type text,
  content text,
  metadata jsonb default '{}'::jsonb,
  memory_embedding double precision[] default null
)
returns table (
  id uuid,
  saved_memory_type text,
  saved_content text,
  saved_metadata jsonb,
  created_at timestamptz
)
language plpgsql
volatile
as $$
begin
  return query
  insert into assistant.memories (memory_type, content, metadata, embedding)
  values (
    coalesce(nullif(trim(memory_type), ''), 'note'),
    trim(content),
    coalesce(metadata, '{}'::jsonb),
    case
      when memory_embedding is null then null
      else memory_embedding::vector(1536)
    end
  )
  returning
    assistant.memories.id,
    assistant.memories.memory_type,
    assistant.memories.content,
    assistant.memories.metadata,
    assistant.memories.created_at;
end;
$$;

create or replace function public.assistant_forget_memory(memory_id uuid)
returns table (
  id uuid,
  forgotten_content text
)
language sql
volatile
as $$
  delete from assistant.memories
  where memories.id = memory_id
  returning memories.id, memories.content;
$$;

create or replace function public.assistant_recent_memories(memory_count integer default 20)
returns table (
  id uuid,
  memory_type text,
  content text,
  metadata jsonb,
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
    memories.created_at
  from assistant.memories
  order by memories.created_at desc
  limit least(greatest(memory_count, 1), 50);
$$;

revoke all on function public.assistant_create_memory(text, text, jsonb, double precision[]) from public;
revoke all on function public.assistant_create_memory(text, text, jsonb, double precision[]) from anon;
revoke all on function public.assistant_create_memory(text, text, jsonb, double precision[]) from authenticated;
grant execute on function public.assistant_create_memory(text, text, jsonb, double precision[]) to service_role;

revoke all on function public.assistant_forget_memory(uuid) from public;
revoke all on function public.assistant_forget_memory(uuid) from anon;
revoke all on function public.assistant_forget_memory(uuid) from authenticated;
grant execute on function public.assistant_forget_memory(uuid) to service_role;

revoke all on function public.assistant_recent_memories(integer) from public;
revoke all on function public.assistant_recent_memories(integer) from anon;
revoke all on function public.assistant_recent_memories(integer) from authenticated;
grant execute on function public.assistant_recent_memories(integer) to service_role;
