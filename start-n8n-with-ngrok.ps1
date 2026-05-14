$ErrorActionPreference = "Stop"

$Workspace = "C:\Users\Admin\Documents\Codex\2026-05-14\i-want-to-start-a-small"
$LogDir = Join-Path $Workspace "logs"
$NgrokExe = "C:\Users\Admin\ngrok.exe"
$N8nCmd = "C:\Users\Admin\AppData\Roaming\npm\n8n.cmd"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$EnvFile = Join-Path $Workspace ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
        $name, $value = $line.Split("=", 2)
        $name = $name.Trim()
        $value = $value.Trim().Trim('"')
        if ($name) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

if (-not (Get-Process -Name ngrok -ErrorAction SilentlyContinue)) {
    Start-Process `
        -FilePath $NgrokExe `
        -ArgumentList "http 5678" `
        -WorkingDirectory $Workspace `
        -RedirectStandardOutput (Join-Path $LogDir "ngrok.out.log") `
        -RedirectStandardError (Join-Path $LogDir "ngrok.err.log") `
        -WindowStyle Hidden
}

$publicUrl = $null
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    try {
        $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 5
        $publicUrl = ($tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1).public_url
        if ($publicUrl) { break }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $publicUrl) {
    throw "Could not get an HTTPS ngrok URL. Check logs\ngrok.err.log."
}

if (-not $publicUrl.EndsWith("/")) {
    $publicUrl = "$publicUrl/"
}

Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

$env:WEBHOOK_URL = $publicUrl
$env:N8N_EDITOR_BASE_URL = "http://localhost:5678"
$env:N8N_PROTOCOL = "http"
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = "false"
$env:SUPABASE_URL = if ($env:SUPABASE_URL) { $env:SUPABASE_URL } else { "https://uxdueryjbfzfvyznxgax.supabase.co" }

Start-Process `
    -FilePath $N8nCmd `
    -ArgumentList "start" `
    -WorkingDirectory $Workspace `
    -RedirectStandardOutput (Join-Path $LogDir "n8n.out.log") `
    -RedirectStandardError (Join-Path $LogDir "n8n.err.log") `
    -WindowStyle Hidden

Write-Host "n8n starting with WEBHOOK_URL=$publicUrl"
Write-Host "Open: $publicUrl"
