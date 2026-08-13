<#
.SYNOPSIS
    Reports whether the machine-wide shared server (live health check - it's
    not owned by this project, see ~\.claude\opencode-bridge-server\) and
    each of this project's agent watchers is ACTIVE, STALE, or OFFLINE, and
    surfaces any recent unresolved alerts (model rotated out, rate limits,
    etc.) so they're visible without having to go looking.

.PARAMETER AgentId
    Optional. Check a single agent instead of all agents.

.EXAMPLE
    .\Get-AgentStatus.ps1
    .\Get-AgentStatus.ps1 -AgentId deepseek-worker
#>
param(
    [string]$BridgeRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$AgentId
)

$ConfigPath = Join-Path $BridgeRoot "config\agents.json"
$cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
$staleAfter = $(if ($cfg.staleAfterMissedBeats) { $cfg.staleAfterMissedBeats } else { 3 })

# --- Shared server row (machine-wide, not owned by this project - live
# health check against it rather than reading a per-project status file,
# since there isn't one anymore) ---
$serverState = "OFFLINE"
try {
    $resp = Invoke-RestMethod -Uri "http://$($cfg.server.hostname):$($cfg.server.port)/global/health" -Method Get -TimeoutSec 3
    $serverState = if ($resp.healthy -eq $true) { "ACTIVE" } else { "UNHEALTHY" }
} catch {
    $serverState = "UNREACHABLE (falls back to standalone opencode run per task - slower, not broken)"
}
Write-Host "Shared server ($($cfg.server.hostname):$($cfg.server.port), machine-wide): $serverState" -ForegroundColor $(if ($serverState -eq 'ACTIVE') { 'Green' } else { 'Yellow' })
Write-Host "  (full server diagnostics: ~\.claude\opencode-bridge-server\scripts\Get-ServerStatus.ps1)"
Write-Host ""

# --- Agent rows ---
$agents = $cfg.agents
if ($AgentId) { $agents = $agents | Where-Object { $_.id -eq $AgentId } }

$rows = foreach ($agent in $agents) {
    $statusPath = Join-Path $BridgeRoot "agents\$($agent.id)\logs\status.json"
    $state = "OFFLINE"
    $lastBeat = $null
    $ageSec = $null
    $activeModel = $null

    if (Test-Path $statusPath) {
        try {
            $s = Get-Content -Raw -Path $statusPath | ConvertFrom-Json
            $lastBeat = [DateTime]$s.lastHeartbeat
            $ageSec = [math]::Round(((Get-Date) - $lastBeat).TotalSeconds, 1)
            $pollInterval = $(if ($s.pollIntervalSec) { $s.pollIntervalSec } else { 5 })
            $threshold = $staleAfter * $pollInterval
            $state = $(if ($ageSec -le $threshold) { "ACTIVE" } else { "STALE" })
            $activeModel = if ($s.models) { $s.models[0] } else { $s.model }
        } catch {
            $state = "UNKNOWN"
        }
    }

    [pscustomobject]@{
        AgentId       = $agent.id
        PrimaryModel  = $activeModel
        State         = $state
        LastHeartbeat = $lastBeat
        AgeSec        = $ageSec
    }
}

$rows | Format-Table -AutoSize

if ($rows | Where-Object { $_.State -eq 'OFFLINE' }) {
    Write-Host "OFFLINE can mean either 'crashed/never started' OR simply 'no Claude Code session has" -ForegroundColor DarkGray
    Write-Host "opened in this project yet this login' - watchers no longer auto-start at logon, see the" -ForegroundColor DarkGray
    Write-Host "opencode-agents-bridge skill's Lifecycle section. Run Start-Watchers.ps1 to bring it up." -ForegroundColor DarkGray
}

# --- Recent alerts (unresolved-worth-a-look signal) ---
$globalAlerts = Join-Path $BridgeRoot "alerts.jsonl"
if (Test-Path $globalAlerts) {
    $recent = Get-Content -Path $globalAlerts -Tail 10 | ForEach-Object {
        try { $_ | ConvertFrom-Json } catch { $null }
    } | Where-Object { $_ }
    if ($recent) {
        Write-Host ""
        Write-Host "Recent alerts (last 10, see alerts.jsonl for full history):" -ForegroundColor Yellow
        $recent | Format-Table -Property ts, agentId, category, detail -AutoSize
    }
}
