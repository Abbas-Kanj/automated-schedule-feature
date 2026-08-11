<#
.SYNOPSIS
    Registers a Windows Task Scheduler task for every enabled agent in
    config\agents.json, so each agent's watcher starts automatically at
    logon and restarts itself if it crashes.

.DESCRIPTION
    Run this once (from a normal PowerShell window, no admin required
    for AtLogOn-in-current-session tasks) after you've installed OpenCode
    and confirmed config\agents.json looks right. Safe to re-run any time
    you add/remove/edit agents - it unregisters and re-registers each task.

.EXAMPLE
    cd <bridge>\scripts
    .\Register-Watchers.ps1
#>
param(
    [string]$BridgeRoot = (Split-Path -Parent $PSScriptRoot)
)

$ConfigPath  = Join-Path $BridgeRoot "config\agents.json"
$WatchScript = Join-Path $BridgeRoot "scripts\Watch-Agent.ps1"

if (-not (Test-Path $ConfigPath))  { throw "Missing config: $ConfigPath" }
if (-not (Test-Path $WatchScript)) { throw "Missing script: $WatchScript" }

$cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json

foreach ($agent in $cfg.agents) {
    if ($agent.enabled -eq $false) {
        Write-Host "Skipping disabled agent '$($agent.id)'"
        continue
    }

    $taskName = "OpenCodeBridge-$($agent.id)"
    $argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$WatchScript`" -AgentId `"$($agent.id)`" -BridgeRoot `"$BridgeRoot`""

    $action   = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
    $trigger  = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
        -MultipleInstances IgnoreNew

    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Description "OpenCode Bridge watcher for agent '$($agent.id)'" | Out-Null

    Start-ScheduledTask -TaskName $taskName
    Write-Host "Registered and started '$taskName'"
}

Write-Host ""
Write-Host "Done. Check status with: .\Get-AgentStatus.ps1"
Write-Host "(Tasks are registered to start 'At log on' for the current user. If you need them"
Write-Host " to run even when you're logged off, re-register the task in Task Scheduler GUI"
Write-Host " with 'Run whether user is logged on or not' and supply your Windows password.)"
