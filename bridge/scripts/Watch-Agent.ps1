<#
.SYNOPSIS
    OpenCode Bridge watcher for a single agent.

.DESCRIPTION
    Watches one agent's inbox folder for task JSON files, runs each one
    through the OpenCode CLI (`opencode run`), and writes the result to
    the agent's outbox. Writes a heartbeat file (logs\status.json) on
    every loop tick so callers can tell the watcher is alive before
    delegating work to it. Designed to be started by Task Scheduler
    (see Register-Watchers.ps1) and to run forever.

.PARAMETER AgentId
    The agent id, matching an entry in config\agents.json.

.PARAMETER BridgeRoot
    Path to the bridge folder. Defaults to the parent of this script's
    folder, so it works out of the box when run from scripts\.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\Watch-Agent.ps1 -AgentId deepseek-worker
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$AgentId,

    [string]$BridgeRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

# ---------- Paths ----------
$ConfigPath   = Join-Path $BridgeRoot "config\agents.json"
$AgentRoot    = Join-Path $BridgeRoot "agents\$AgentId"
$InboxDir     = Join-Path $AgentRoot "inbox"
$PendingDir   = Join-Path $AgentRoot "pending"
$OutboxDir    = Join-Path $AgentRoot "outbox"
$LogsDir      = Join-Path $AgentRoot "logs"
$TaskLogsDir  = Join-Path $LogsDir "tasks"
$StatusPath   = Join-Path $LogsDir "status.json"
$WatcherLog   = Join-Path $LogsDir "watcher.log"
$AgentNotify  = Join-Path $LogsDir "notifications.jsonl"
$GlobalNotify = Join-Path $BridgeRoot "notifications.jsonl"

foreach ($d in @($InboxDir, $PendingDir, $OutboxDir, $LogsDir, $TaskLogsDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

function Write-Log {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "o"), $Message
    Add-Content -Path $WatcherLog -Value $line
    # Keep the log from growing forever
    if ((Get-Item $WatcherLog).Length -gt 5MB) {
        $tail = Get-Content $WatcherLog -Tail 2000
        Set-Content -Path $WatcherLog -Value $tail
    }
}

function Get-AgentConfig {
    $cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
    $agent = $cfg.agents | Where-Object { $_.id -eq $AgentId }
    if (-not $agent) {
        throw "Agent '$AgentId' not found in $ConfigPath"
    }
    $poll = 5
    if ($cfg.pollIntervalSec) { $poll = $cfg.pollIntervalSec }
    return [pscustomobject]@{ Agent = $agent; PollIntervalSec = $poll }
}

function Write-Heartbeat {
    param($Agent, [int]$PollIntervalSec)
    $status = [ordered]@{
        agentId         = $AgentId
        pid             = $PID
        status          = "active"
        model           = $Agent.model
        pollIntervalSec = $PollIntervalSec
        startedAt       = $Script:StartedAt
        lastHeartbeat   = (Get-Date).ToString("o")
    }
    $status | ConvertTo-Json -Depth 5 | Set-Content -Path $StatusPath -Encoding UTF8
}

function Add-Notification {
    param($Record)
    $json = $Record | ConvertTo-Json -Depth 5 -Compress
    Add-Content -Path $AgentNotify -Value $json
    Add-Content -Path $GlobalNotify -Value $json
}

function Invoke-OpenCodeTask {
    param($Task, $Agent)

    $argsList = @("run", "--format", "json")
    if ($Agent.model)         { $argsList += @("-m", $Agent.model) }
    if ($Agent.opencodeAgent) { $argsList += @("--agent", $Agent.opencodeAgent) }
    if ($Agent.autoApprove)   { $argsList += "--auto" }
    if ($Task.files) {
        foreach ($f in $Task.files) { $argsList += @("-f", $f) }
    }
    if ($Task.cwd) { $argsList += @("--dir", $Task.cwd) }
    $argsList += @("--title", "bridge-$AgentId-$($Task.id)")
    $argsList += [string]$Task.prompt

    $stdOutPath = Join-Path $TaskLogsDir "$($Task.id).stdout.log"
    $stdErrPath = Join-Path $TaskLogsDir "$($Task.id).stderr.log"

    $start = Get-Date
    $exitCode = 0
    try {
        $proc = Start-Process -FilePath "opencode" -ArgumentList $argsList `
            -NoNewWindow -Wait -PassThru `
            -RedirectStandardOutput $stdOutPath -RedirectStandardError $stdErrPath
        $exitCode = $proc.ExitCode
    }
    catch {
        # opencode not found / failed to launch at all
        Set-Content -Path $stdErrPath -Value "$_"
        $exitCode = -1
    }
    $finish = Get-Date

    $stdout = ""
    $stderr = ""
    if (Test-Path $stdOutPath) { $stdout = Get-Content -Raw -Path $stdOutPath -ErrorAction SilentlyContinue }
    if (Test-Path $stdErrPath) { $stderr = Get-Content -Raw -Path $stdErrPath -ErrorAction SilentlyContinue }

    $rawJson = $null
    try { $rawJson = $stdout | ConvertFrom-Json -ErrorAction Stop } catch { $rawJson = $null }

    $statusText = $(if ($exitCode -eq 0) { "success" } else { "error" })

    return [ordered]@{
        id           = $Task.id
        agentId      = $AgentId
        model        = $Agent.model
        status       = $statusText
        exit_code    = $exitCode
        started_at   = $start.ToString("o")
        finished_at  = $finish.ToString("o")
        duration_sec = [math]::Round(($finish - $start).TotalSeconds, 2)
        output       = $stdout
        raw_json     = $rawJson
        error        = $(if ($exitCode -ne 0) { $stderr } else { $null })
    }
}

$Script:StartedAt = (Get-Date).ToString("o")
Write-Log "Watcher starting for agent '$AgentId' (PID $PID)"

while ($true) {
    try {
        $loaded = Get-AgentConfig
        $agent  = $loaded.Agent
        $poll   = $loaded.PollIntervalSec

        Write-Heartbeat -Agent $agent -PollIntervalSec $poll

        if ($agent.enabled -eq $false) {
            Start-Sleep -Seconds $poll
            continue
        }

        $next = Get-ChildItem -Path $InboxDir -Filter "*.json" -File -ErrorAction SilentlyContinue |
            Sort-Object CreationTimeUtc | Select-Object -First 1

        if ($next) {
            $pendingPath = Join-Path $PendingDir $next.Name
            Move-Item -Path $next.FullName -Destination $pendingPath -Force

            try {
                $task = Get-Content -Raw -Path $pendingPath | ConvertFrom-Json
                if (-not $task.id) { $task | Add-Member -NotePropertyName id -NotePropertyValue ([IO.Path]::GetFileNameWithoutExtension($next.Name)) -Force }

                Write-Log "Processing task $($task.id)"
                $result = Invoke-OpenCodeTask -Task $task -Agent $agent

                $resultPath = Join-Path $OutboxDir "$($task.id).result.json"
                $result | ConvertTo-Json -Depth 10 | Set-Content -Path $resultPath -Encoding UTF8

                Add-Notification -Record @{
                    ts      = (Get-Date).ToString("o")
                    agentId = $AgentId
                    taskId  = $task.id
                    status  = $result.status
                    outbox  = "agents/$AgentId/outbox/$($task.id).result.json"
                }

                Remove-Item -Path $pendingPath -Force -ErrorAction SilentlyContinue
                Write-Log "Finished task $($task.id) with status $($result.status)"
            }
            catch {
                $failId = [IO.Path]::GetFileNameWithoutExtension($next.Name)
                Write-Log "ERROR processing $($next.Name): $_"
                $errResult = [ordered]@{
                    id          = $failId
                    agentId     = $AgentId
                    status      = "error"
                    error       = "$_"
                    finished_at = (Get-Date).ToString("o")
                }
                $errPath = Join-Path $OutboxDir "$failId.result.json"
                $errResult | ConvertTo-Json -Depth 5 | Set-Content -Path $errPath -Encoding UTF8
                Add-Notification -Record @{
                    ts      = (Get-Date).ToString("o")
                    agentId = $AgentId
                    taskId  = $failId
                    status  = "error"
                    outbox  = "agents/$AgentId/outbox/$failId.result.json"
                }
                Remove-Item -Path $pendingPath -Force -ErrorAction SilentlyContinue
            }
        }
        else {
            Start-Sleep -Seconds $poll
        }
    }
    catch {
        Write-Log "FATAL loop error: $_"
        Start-Sleep -Seconds 5
    }
}
