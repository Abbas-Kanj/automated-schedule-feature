<#
.SYNOPSIS
    Stops and removes this project's Task Scheduler entries created by
    Register-Watchers.ps1. Does NOT touch the machine-wide shared server -
    that's registered separately (~\.claude\opencode-bridge-server\scripts\
    Unregister-Server.ps1) since other projects may still depend on it.
#>
param(
    [string]$BridgeRoot = (Split-Path -Parent $PSScriptRoot)
)

$ConfigPath = Join-Path $BridgeRoot "config\agents.json"
$cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
$slug = $cfg.projectSlug

foreach ($agent in $cfg.agents) {
    $taskName = "OpenCodeBridge-$slug-$($agent.id)"
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed '$taskName'"
}
