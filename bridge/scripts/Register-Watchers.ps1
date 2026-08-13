<#
.SYNOPSIS
    Registers a Windows Task Scheduler task for every enabled agent in
    config\agents.json, so the watcher process exists and auto-restarts
    itself if it crashes - but does NOT start automatically at logon.
    Starting/stopping is on-demand, driven by a Claude Code session opening
    or closing in this project (see "Lifecycle" below).

.DESCRIPTION
    Run from an ELEVATED PowerShell window ("Run as Administrator") if
    possible - Register-ScheduledTask has been observed to throw Access
    Denied non-elevated on at least one machine even for a benign trigger
    (see the windows-task-scheduler-claude-code-access-denied skill), though
    this is machine-dependent; try non-elevated first and only escalate if
    it fails. Safe to re-run any time you add/remove/edit agents - it
    unregisters and re-registers each task.

    Does NOT register the shared 'opencode serve' instance - that's
    machine-wide, not per-project, registered once via
    ~\.claude\opencode-bridge-server\scripts\Register-Server.ps1. Run that
    first if it isn't already running (check with
    ~\.claude\opencode-bridge-server\scripts\Get-ServerStatus.ps1).

    Task names are prefixed with this project's 'projectSlug' from
    config\agents.json (e.g. "OpenCodeBridge-automated-schedule-feature-
    deepseek-worker") so multiple projects' watchers never collide in Task
    Scheduler even when they use agent ids in common (e.g. every project
    having its own "deepseek-worker").

.DESCRIPTION (Lifecycle - deliberately no auto-start trigger)
    Standing rule (Kanj, Aug 13 2026): a project's bridge watchers must not
    be running just because the machine is logged in - they only exist
    while a Claude Code session is actually open in that project. So these
    tasks are registered with NO trigger at all (not AtLogOn) - they sit
    "Ready" but dormant until something explicitly calls Start-ScheduledTask.
    That "something" is the global SessionStart hook
    (~\.claude\hooks\bridge-session-start.py), which runs this project's
    Start-Watchers.ps1 whenever a Claude Code session starts with this
    project as its cwd; the matching SessionEnd hook
    (~\.claude\hooks\bridge-session-end.py) runs Stop-Watchers.ps1 when that
    session ends. Registering here does NOT start them - run
    Start-Watchers.ps1 yourself if you want to smoke-test immediately
    without waiting for a session boundary.

.EXAMPLE
    cd <bridge>\scripts
    .\Register-Watchers.ps1
    .\Start-Watchers.ps1   # optional - only if you want them live right now
#>
param(
    [string]$BridgeRoot = (Split-Path -Parent $PSScriptRoot)
)

$ConfigPath  = Join-Path $BridgeRoot "config\agents.json"
$WatchScript = Join-Path $BridgeRoot "scripts\Watch-Agent.ps1"

if (-not (Test-Path $ConfigPath))  { throw "Missing config: $ConfigPath" }
if (-not (Test-Path $WatchScript)) { throw "Missing script: $WatchScript" }

$cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
if (-not $cfg.projectSlug) {
    throw "config\agents.json is missing 'projectSlug' - required so this project's Scheduled Task names don't collide with another project's. Add e.g. `"projectSlug`": `"$(Split-Path -Leaf $BridgeRoot)`" and re-run."
}
$slug = $cfg.projectSlug

# The Task Scheduler action calls powershell.exe DIRECTLY - Watch-Agent.ps1
# hides its own console window on startup (Win32 ShowWindow) instead of
# being launched through a wscript.exe/WshShell.Run hidden-launch wrapper.
# That indirection was tried first and is a real bug: Task Scheduler only
# tracks the process it directly launches (wscript.exe), and the actual
# watcher is a grandchild WshShell.Run spawns that Windows does NOT
# auto-terminate when wscript.exe is killed (no Job Object relationship) -
# so Stop-ScheduledTask silently orphans the real process instead of killing
# it. See vbs-trampoline-orphans-tracked-process.
foreach ($agent in $cfg.agents) {
    if ($agent.enabled -eq $false) {
        Write-Host "Skipping disabled agent '$($agent.id)'"
        continue
    }

    $taskName = "OpenCodeBridge-$slug-$($agent.id)"
    # -WindowStyle Hidden on top of Watch-Agent.ps1's own post-startup
    # Win32 ShowWindow(SW_HIDE) call - belt and suspenders. -WindowStyle
    # Hidden alone isn't fully reliable for every PowerShell host/launch
    # path, and the self-hide alone leaves a brief flash on some machines;
    # together neither gap shows up. Never remove either half independently.
    $argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$WatchScript`" -AgentId `"$($agent.id)`" -BridgeRoot `"$BridgeRoot`""

    $action   = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
        -MultipleInstances IgnoreNew

    # Stop before unregister - Unregister-ScheduledTask removes the task
    # DEFINITION, it does not kill an instance already running under it. Skip
    # the stop and a currently-running watcher survives as an orphan Task
    # Scheduler no longer tracks (same failure shape as
    # vbs-trampoline-orphans-tracked-process, different cause: here it's
    # deregistration, not a wscript.exe indirection layer).
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

    # No -Trigger: deliberate, see the Lifecycle note above - this task must
    # exist (so Start-ScheduledTask has something to start / restart-on-crash
    # applies once it's running) but must NOT fire on its own at logon.
    # Started/stopped only by Start-Watchers.ps1 / Stop-Watchers.ps1, which
    # the global SessionStart/SessionEnd hooks call automatically.
    Register-ScheduledTask -TaskName $taskName -Action $action `
        -Settings $settings -Description "OpenCode Bridge watcher for agent '$($agent.id)' in project '$slug' - no auto-start trigger by design, started on-demand by the Claude Code SessionStart hook" | Out-Null

    Write-Host "Registered '$taskName' (not started - dormant until a Claude Code session opens in this project, or run Start-Watchers.ps1)"
}

Write-Host ""
Write-Host "Done. Check status with: .\Get-AgentStatus.ps1"
Write-Host "Make sure the shared server is running too: ~\.claude\opencode-bridge-server\scripts\Get-ServerStatus.ps1"
Write-Host ""
Write-Host "Tasks are registered with NO auto-start trigger on purpose (see this script's"
Write-Host "Lifecycle doc comment) - they start/stop automatically with Claude Code sessions"
Write-Host "in this project via the global SessionStart/SessionEnd hooks. Run .\Start-Watchers.ps1"
Write-Host "now if you want them live immediately (e.g. to smoke-test) without waiting for that."
