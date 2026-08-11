<#
.SYNOPSIS
    Stops and removes the Task Scheduler entries created by Register-Watchers.ps1.
#>
param(
    [string]$BridgeRoot = (Split-Path -Parent $PSScriptRoot)
)

$ConfigPath = Join-Path $BridgeRoot "config\agents.json"
$cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json

foreach ($agent in $cfg.agents) {
    $taskName = "OpenCodeBridge-$($agent.id)"
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed '$taskName'"
}
