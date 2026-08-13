<#
.SYNOPSIS
    Stops this project's running watcher Scheduled Tasks, unless a task is
    actively mid-run (its pending\ folder is non-empty), in which case it's
    left running rather than interrupted.

.DESCRIPTION
    Companion to Start-Watchers.ps1 - see its doc comment and
    Register-Watchers.ps1's Lifecycle note for the on-demand start/stop
    design this replaced AtLogOn auto-start with. This is the script the
    global SessionEnd hook (~\.claude\hooks\bridge-session-end.py) runs
    automatically whenever a Claude Code session ends with this project as
    its cwd.

    Safety: Watch-Agent.ps1 processes one task fully (synchronously) before
    picking up the next - there is no checkpoint/resume, so Stop-ScheduledTask
    on a watcher mid-task would silently lose that task's result (no error,
    no notification, no output file). Before stopping any agent's task, this
    script checks whether agents\<id>\pending\ has any file in it - that's
    exactly the window between "task picked up" and "result written" (see
    Watch-Agent.ps1's main loop: Move-Item into pending\ happens first,
    Remove-Item out of it happens last). If so, that agent's watcher is left
    running; it'll be caught by a later Stop-Watchers.ps1 run once idle.

    Caveat this does NOT handle: two Claude Code sessions open in the same
    project at once - this SessionEnd-driven stop has no concept of "another
    session is still using this bridge" and will stop watchers out from
    under a sibling session. Acceptable for the current single-session-per-
    project usage pattern; revisit (e.g. a session-count file) if that
    changes.

.PARAMETER BridgeRoot
    Path to the bridge folder. Defaults to the parent of this script's
    folder, so it works out of the box when run from scripts\.

.EXAMPLE
    cd <bridge>\scripts
    .\Stop-Watchers.ps1
#>
param(
    [string]$BridgeRoot = (Split-Path -Parent $PSScriptRoot)
)

$ConfigPath = Join-Path $BridgeRoot "config\agents.json"
if (-not (Test-Path $ConfigPath)) {
    Write-Host "No config\agents.json found under $BridgeRoot - nothing to stop."
    exit 0
}

$cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
$slug = $cfg.projectSlug
if (-not $slug) {
    Write-Host "config\agents.json is missing 'projectSlug' - can't resolve this project's task names."
    exit 1
}

$stopped = 0
$skippedBusy = 0
$alreadyStopped = 0
$failed = @()

foreach ($agent in $cfg.agents) {
    $taskName = "OpenCodeBridge-$slug-$($agent.id)"
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if (-not $task -or $task.State -ne 'Running') {
        $alreadyStopped++
        continue
    }

    $pendingDir = Join-Path $BridgeRoot "agents\$($agent.id)\pending"
    $inFlight = $false
    if (Test-Path $pendingDir -PathType Container) {
        # Filter -Filter "*.md": pending\ can legitimately hold a non-task
        # placeholder (a .keep file, committed to git so this normally-empty
        # dir survives being tracked - see Bootstrap-Project.ps1's .gitignore,
        # which excludes outbox\/logs\ but not pending\/inbox\). Only *.md
        # counts as "in flight" - that's exactly what Watch-Agent.ps1's main
        # loop moves into pending\ (task descriptor + its .prompt.md
        # companion). Counting a .keep file as a real task would leave every
        # watcher permanently un-stoppable.
        $inFlight = (Get-ChildItem -Path $pendingDir -Filter "*.md" -File -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0
    }
    if ($inFlight) {
        Write-Host "  '$taskName' has a task in flight (pending\ non-empty) - leaving it running."
        $skippedBusy++
        continue
    }

    try {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop
        $stopped++
        Write-Host "  Stopped '$taskName'"
    } catch {
        $failed += "$taskName ($_)"
    }
}

Write-Host "Bridge watchers for '$slug': $stopped stopped, $skippedBusy left running (task in flight), $alreadyStopped already stopped."
if ($failed.Count -gt 0) {
    Write-Host "  Failed to stop: $($failed -join '; ')"
    exit 1
}
