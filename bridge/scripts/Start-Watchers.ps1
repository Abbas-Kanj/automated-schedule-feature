<#
.SYNOPSIS
    Starts this project's already-registered watcher Scheduled Tasks (one
    per enabled agent in config\agents.json), skipping any already running.

.DESCRIPTION
    Companion to Stop-Watchers.ps1, forming the on-demand lifecycle that
    replaced the old AtLogOn auto-start (see Register-Watchers.ps1's
    Lifecycle doc comment - watchers must not run just because the machine
    is logged in, only while a Claude Code session is open in this
    project). This is the script the global SessionStart hook
    (~\.claude\hooks\bridge-session-start.py) runs automatically whenever a
    Claude Code session starts with this project as its cwd - it does not
    need to be run by hand, but is safe to (e.g. to warm the watchers up
    before delegating, or to smoke-test right after Register-Watchers.ps1).

    Idempotent and cheap: a task already in the 'Running' state is left
    alone, not restarted. A task that isn't registered yet is reported, not
    created - registration needs Register-Watchers.ps1 (which may need
    elevation), this script only starts what already exists.

    Serializes against every OTHER project's Start-Watchers.ps1 via a
    machine-wide named Mutex, not just this project's own agents against
    each other. The per-agent Start-Sleep below only staggers within one
    project's loop - it does nothing when two different projects' bridges
    (each with their own SessionStart hook) happen to fire within the same
    second, e.g. opening Claude Code sessions in two projects close
    together. Confirmed via screenshot 2026-08-20: 8 visible conhost
    windows at once (4 from this project + 4 from a second project's
    bridge), even with the HideConsole.dll fix in place, because both
    projects' 4-agent bursts landed concurrently. The mutex makes one
    project's whole start loop finish (already internally staggered)
    before the next project's loop begins, so no more than one project's
    worth of watchers ever start at the same instant, machine-wide.
    Non-fatal if the mutex can't be created/acquired for any reason (e.g. a
    locked-down environment) - falls through and starts watchers with the
    old per-project-only staggering.

    Does not touch the shared 'opencode serve' instance
    (~\.claude\opencode-bridge-server\) - that's machine-wide and outside
    any one project's lifecycle; Watch-Agent.ps1 already falls back to a
    cold-boot 'opencode run' per task if it's unreachable.

.PARAMETER BridgeRoot
    Path to the bridge folder. Defaults to the parent of this script's
    folder, so it works out of the box when run from scripts\.

.EXAMPLE
    cd <bridge>\scripts
    .\Start-Watchers.ps1
#>
param(
    [string]$BridgeRoot = (Split-Path -Parent $PSScriptRoot)
)

$ConfigPath = Join-Path $BridgeRoot "config\agents.json"
if (-not (Test-Path $ConfigPath)) {
    Write-Host "No config\agents.json found under $BridgeRoot - nothing to start."
    exit 0
}

$cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
$slug = $cfg.projectSlug
if (-not $slug) {
    Write-Host "config\agents.json is missing 'projectSlug' - can't resolve this project's task names."
    exit 1
}

$started = 0
$alreadyRunning = 0
$notRegistered = @()
$failed = @()

# Cross-bridge lock - see the "Serializes against every OTHER project's
# Start-Watchers.ps1" doc comment above. "Global\" so it's visible across
# session/window-station boundaries, not just within this process's own
# session; non-fatal (falls through with $acquired = $false) if creating or
# acquiring it fails for any reason.
$lockAcquired = $false
$lockMutex = $null
try {
    $lockMutex = New-Object System.Threading.Mutex($false, "Global\OpenCodeBridge-StartWatchers")
    $lockAcquired = $lockMutex.WaitOne([TimeSpan]::FromSeconds(20))
    if (-not $lockAcquired) {
        Write-Host "  (cross-bridge start lock busy after 20s - proceeding without it, another project's watchers may be starting concurrently)"
    }
} catch {
    Write-Host "  (cross-bridge start lock unavailable - proceeding without it: $_)"
}

try {
    foreach ($agent in $cfg.agents) {
        if ($agent.enabled -eq $false) { continue }
        $taskName = "OpenCodeBridge-$slug-$($agent.id)"
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if (-not $task) {
            $notRegistered += $taskName
            continue
        }
        if ($task.State -eq 'Running') {
            $alreadyRunning++
            continue
        }
        try {
            Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
            $started++
            Write-Host "  Started '$taskName'"
            # Stagger consecutive starts - see Watch-Agent.ps1's self-hide
            # comment (HideConsole.dll) for why: launching every agent's task
            # in the same instant made even the precompiled hide helper's
            # Add-Type -Path load contend enough (alongside a dozen+ fresh
            # powershell.exe cold-starts at once) to be visibly slow. A small
            # gap keeps each watcher's brief startup window from overlapping
            # with the next one's. This only covers agents within THIS
            # project's own loop - the mutex above covers other projects.
            Start-Sleep -Milliseconds 150
        } catch {
            $failed += "$taskName ($_)"
        }
    }
} finally {
    if ($lockAcquired) { $lockMutex.ReleaseMutex() }
    if ($lockMutex) { $lockMutex.Dispose() }
}

Write-Host "Bridge watchers for '$slug': $started started, $alreadyRunning already running."
if ($notRegistered.Count -gt 0) {
    Write-Host "  Not registered yet (run Register-Watchers.ps1 first): $($notRegistered -join ', ')"
}
if ($failed.Count -gt 0) {
    Write-Host "  Failed to start: $($failed -join '; ')"
    exit 1
}
