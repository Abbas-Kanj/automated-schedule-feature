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
    } catch {
        $failed += "$taskName ($_)"
    }
}

Write-Host "Bridge watchers for '$slug': $started started, $alreadyRunning already running."
if ($notRegistered.Count -gt 0) {
    Write-Host "  Not registered yet (run Register-Watchers.ps1 first): $($notRegistered -join ', ')"
}
if ($failed.Count -gt 0) {
    Write-Host "  Failed to start: $($failed -join '; ')"
    exit 1
}
