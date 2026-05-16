$ErrorActionPreference = "Stop"

$Workspace = "C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small"
$LogDir = Join-Path $Workspace "logs"
$N8nCmd = "C:\Users\Admin\AppData\Roaming\npm\n8n.cmd"
$MusicUserFolder = Join-Path $env:USERPROFILE ".n8n-music"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path $MusicUserFolder | Out-Null

Get-NetTCPConnection -LocalPort 5680 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

$env:N8N_USER_FOLDER = $MusicUserFolder
$env:N8N_PORT = "5680"
$env:N8N_EDITOR_BASE_URL = "http://localhost:5680"
$env:N8N_PROTOCOL = "http"
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = "false"
$env:N8N_RUNNERS_BROKER_PORT = "5681"

Start-Process `
    -FilePath $N8nCmd `
    -ArgumentList "start" `
    -WorkingDirectory $Workspace `
    -RedirectStandardOutput (Join-Path $LogDir "n8n-music.out.log") `
    -RedirectStandardError (Join-Path $LogDir "n8n-music.err.log") `
    -WindowStyle Hidden

Write-Host "Music n8n starting on http://localhost:5680"
Write-Host "Music n8n user folder: $MusicUserFolder"
