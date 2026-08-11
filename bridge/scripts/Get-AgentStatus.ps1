<#
.SYNOPSIS
    Reports whether each agent's watcher is ACTIVE, STALE, or OFFLINE by
    checking the freshness of its heartbeat file (agents\<id>\logs\status.json).

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

$agents = $cfg.agents
if ($AgentId) { $agents = $agents | Where-Object { $_.id -eq $AgentId } }

$rows = foreach ($agent in $agents) {
    $statusPath = Join-Path $BridgeRoot "agents\$($agent.id)\logs\status.json"
    $state = "OFFLINE"
    $lastBeat = $null
    $ageSec = $null

    if (Test-Path $statusPath) {
        try {
            $s = Get-Content -Raw -Path $statusPath | ConvertFrom-Json
            $lastBeat = [DateTime]$s.lastHeartbeat
            $ageSec = [math]::Round(((Get-Date) - $lastBeat).TotalSeconds, 1)
            $pollInterval = $(if ($s.pollIntervalSec) { $s.pollIntervalSec } else { 5 })
            $threshold = $staleAfter * $pollInterval
            $state = $(if ($ageSec -le $threshold) { "ACTIVE" } else { "STALE" })
        } catch {
            $state = "UNKNOWN"
        }
    }

    [pscustomobject]@{
        AgentId       = $agent.id
        Model         = $agent.model
        State         = $state
        LastHeartbeat = $lastBeat
        AgeSec        = $ageSec
    }
}

$rows | Format-Table -AutoSize
