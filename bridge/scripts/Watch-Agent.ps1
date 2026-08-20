<#
.SYNOPSIS
    OpenCode Bridge watcher for a single agent (v2 - md/txt task+result files,
    free-model-only with live-catalog health check + fallback chain, shared
    'opencode serve' via --attach, broadened error classification, throttled
    silent alerts).

.DESCRIPTION
    Watches one agent's inbox folder for task descriptor files (<id>.md,
    frontmatter pointing at a separate <id>.prompt.md holding the actual
    prompt text), runs each one through the OpenCode CLI, and writes a
    human-readable markdown result to the agent's outbox. Writes a heartbeat
    file (logs\status.json) on every loop tick so callers can tell the
    watcher is alive before delegating work to it. Designed to be started by
    Task Scheduler (see Register-Watchers.ps1) and to run forever.

    Before firing any task, checks the LIVE OpenCode Zen model catalog
    (https://opencode.ai/zen/v1/models - unauthenticated, no opencode CLI
    needed) rather than trusting the CLI's own cached 'opencode models' list,
    which has been observed to lag behind it. Free models on Zen are
    explicitly time-limited and rotate without notice, so agents.json lists
    each agent's models as a priority-ordered fallback chain; the watcher
    walks it to the first model still present in the live catalog.

    --attach to the shared 'opencode serve' instance is CURRENTLY DISABLED
    (forced off in Invoke-OpenCodeTask) - confirmed broken on opencode CLI
    1.18.16, see the opencode-cli-json-and-free-tier-gotchas skill: the
    process exits 0 after the first event and never returns actual output.
    Every task runs standalone (cold-boot) until a newer CLI version is
    verified to fix this.

    Hides its own console window directly (Win32 ShowWindow after startup)
    rather than being launched via a hidden-launch wrapper script - see the
    vbs-trampoline-orphans-tracked-process skill for why a wscript.exe/
    WshShell.Run indirection layer breaks Stop-ScheduledTask silently.

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

# Hide this process's own console window directly, rather than being
# launched through a hidden-launch wrapper (wscript.exe + WshShell.Run).
# That indirection was tried first and is a real bug, not a style choice:
# Task Scheduler only tracks the process it directly launched (wscript.exe);
# the actual watcher is a grandchild WshShell.Run spawns, which Windows does
# NOT auto-terminate when its "parent" is killed (no Job Object relationship)
# - so Stop-ScheduledTask reports success while the real watcher keeps
# running orphaned, and the next Start-ScheduledTask piles another one on
# top. Hiding the window from inside the actual tracked process avoids the
# indirection (and the bug) entirely. Non-fatal if it fails for any reason -
# worst case the console stays visible, the watcher still works.
#
# Loads a PRECOMPILED helper (HideConsole.dll, built by
# Build-HideConsoleDll.ps1) instead of compiling the P/Invoke shim from
# inline C# via Add-Type -MemberDefinition on every startup. That used to
# be the only path - fine for one watcher, but a session start fires every
# enabled agent's task at once (a dozen+ processes machine-wide), and that
# many concurrent csc.exe cold-starts made the combined compile time long
# enough for the console window to actually be visible for several seconds
# (not the sub-second flash this was designed around) - confirmed via
# screenshots 2026-08-17. Add-Type -Path (a plain assembly load) has no
# compiler involved, so it's near-instant regardless of how many watchers
# start together. Falls back to the old inline-compile path if the dll is
# missing (e.g. a bridge folder copied without it) so this still degrades
# gracefully rather than failing outright - just slow again in that case.
try {
    $hideDll = Join-Path $PSScriptRoot "HideConsole.dll"
    if (Test-Path $hideDll) {
        Add-Type -Path $hideDll -ErrorAction Stop
        [BridgeConsole.Window]::Hide()
    } else {
        Add-Type -Name Window -Namespace Console -MemberDefinition '
            [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
            [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        ' -ErrorAction Stop
        $consolePtr = [Console.Window]::GetConsoleWindow()
        if ($consolePtr -ne [IntPtr]::Zero) { [Console.Window]::ShowWindow($consolePtr, 0) | Out-Null } # 0 = SW_HIDE
    }
} catch {
    # non-fatal, see comment above
}

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
$AgentAlerts  = Join-Path $LogsDir "alerts.jsonl"
$GlobalAlerts = Join-Path $BridgeRoot "alerts.jsonl"
$AlertState   = Join-Path $LogsDir "alert-state.json"

foreach ($d in @($InboxDir, $PendingDir, $OutboxDir, $LogsDir, $TaskLogsDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

function Write-Log {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "o"), $Message
    Add-Content -Path $WatcherLog -Value $line
    if ((Get-Item $WatcherLog).Length -gt 5MB) {
        $tail = Get-Content $WatcherLog -Tail 2000
        Set-Content -Path $WatcherLog -Value $tail
    }
}

function Get-AgentConfig {
    $cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
    $agent = $cfg.agents | Where-Object { $_.id -eq $AgentId }
    if (-not $agent) { throw "Agent '$AgentId' not found in $ConfigPath" }
    $poll = 5
    if ($cfg.pollIntervalSec) { $poll = $cfg.pollIntervalSec }
    $throttle = 30
    if ($cfg.alertThrottleMinutes) { $throttle = $cfg.alertThrottleMinutes }
    $zenUrl = "https://opencode.ai/zen/v1/models"
    if ($cfg.zenModelsEndpoint) { $zenUrl = $cfg.zenModelsEndpoint }
    $serverPort = 4096; $serverHost = "127.0.0.1"
    if ($cfg.server) {
        if ($cfg.server.port) { $serverPort = $cfg.server.port }
        if ($cfg.server.hostname) { $serverHost = $cfg.server.hostname }
    }
    return [pscustomobject]@{
        Agent            = $agent
        PollIntervalSec  = $poll
        AlertThrottleMin = $throttle
        ZenModelsUrl     = $zenUrl
        ServerUrl        = "http://${serverHost}:${serverPort}"
    }
}

function Write-Heartbeat {
    param($Agent, [int]$PollIntervalSec)
    $status = [ordered]@{
        agentId         = $AgentId
        pid             = $PID
        status          = "active"
        models          = $Agent.models
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

# Throttled "silent" alert channel - separate from routine per-task notifications,
# so a burst of identical failures (e.g. a model rotated out mid-afternoon and every
# queued task hits it) doesn't flood the log. One line per (category) per
# $AlertThrottleMin minutes. This is the "notified silently" channel: nothing
# blocks, nothing pops up, but there's exactly one place (alerts.jsonl, agent-level
# and bridge-wide) worth scanning for "does anything here need my attention".
function Add-AlertThrottled {
    param([string]$Category, [string]$Detail, [int]$ThrottleMinutes)
    $state = @{}
    if (Test-Path $AlertState) {
        try { $state = Get-Content -Raw -Path $AlertState | ConvertFrom-Json -AsHashtable } catch { $state = @{} }
    }
    $now = Get-Date
    $last = $null
    if ($state.ContainsKey($Category)) {
        try { $last = [DateTime]$state[$Category] } catch { $last = $null }
    }
    if ($last -and (($now - $last).TotalMinutes -lt $ThrottleMinutes)) {
        return # throttled - already alerted for this category recently
    }
    $state[$Category] = $now.ToString("o")
    $state | ConvertTo-Json -Depth 5 | Set-Content -Path $AlertState -Encoding UTF8

    $record = [ordered]@{
        ts       = $now.ToString("o")
        agentId  = $AgentId
        category = $Category
        detail   = $Detail
    }
    $json = $record | ConvertTo-Json -Depth 5 -Compress
    Add-Content -Path $AgentAlerts -Value $json
    Add-Content -Path $GlobalAlerts -Value $json
    Write-Log "ALERT [$Category] $Detail"
}

# ---------- Live catalog + server health ----------

function Get-LiveFreeCatalogIds {
    param([string]$ZenUrl)
    try {
        $resp = Invoke-RestMethod -Uri $ZenUrl -Method Get -TimeoutSec 5
        return @($resp.data | ForEach-Object { $_.id })
    } catch {
        Write-Log "WARN: could not reach live Zen catalog ($ZenUrl): $_ - failing open, will try primary model as-is"
        return $null   # null = "couldn't check" (fail open), distinct from an empty array
    }
}

function Test-BridgeServerHealthy {
    param([string]$ServerUrl)
    try {
        $resp = Invoke-RestMethod -Uri "$ServerUrl/global/health" -Method Get -TimeoutSec 3
        return ($resp.healthy -eq $true)
    } catch {
        return $false
    }
}

# Walk the agent's models[] (priority order) against the live catalog and
# return the first one still present. Returns $null if none are (or if the
# whole models[] is exhausted) - caller treats that as MODEL_UNAVAILABLE.
#
# Standing rule (Kanj, Aug 11 2026): a model id must contain 'free' to ever
# be eligible, no exceptions - enforced here, not just documented in
# agents.json, so a future misconfiguration can't silently spend money even
# if someone adds a non-free model id to a models[] array by mistake.
function Select-LiveModel {
    param([string[]]$Models, [string[]]$LiveIds)
    foreach ($m in $Models) {
        if ($m -notmatch 'free') {
            Write-Log "SKIPPING configured model '$m' - id does not contain 'free', excluded by standing rule regardless of actual cost"
            continue
        }
        $bareId = $m -replace '^opencode/', ''
        if ($null -eq $LiveIds -or $LiveIds -contains $bareId) {
            return $m   # either couldn't check (fail open -> trust config) or confirmed live
        }
    }
    return $null
}

# ---------- Task file parsing (frontmatter md, not JSON) ----------
#
# Task descriptor <id>.md:
#   ---
#   id: <guid>
#   created_at: <iso8601>
#   prompt_file: <id>.prompt.md
#   files: path/one.ts, path/two.ts
#   cwd: optional/dir
#   priority: normal
#   ---
# The 'prompt_file' value is a filename relative to the same inbox dir - it
# points AT the real prompt, it is not the prompt itself. Read that file's
# full text as the actual instructions to send to the model.

function Parse-Frontmatter {
    param([string]$RawText)
    $lines = $RawText -split "`r?`n"
    $inFm = $false
    $fm = [ordered]@{}
    foreach ($line in $lines) {
        if ($line.Trim() -eq '---') {
            if (-not $inFm) { $inFm = $true; continue } else { break }
        }
        if ($inFm -and $line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$') {
            $fm[$Matches[1]] = $Matches[2].Trim()
        }
    }
    return $fm
}

function Get-TaskFromFile {
    param([string]$TaskFilePath, [string]$InboxDir)
    $raw = Get-Content -Raw -Path $TaskFilePath -Encoding UTF8
    $fm = Parse-Frontmatter -RawText $raw
    if (-not $fm.Contains('id') -or -not $fm['id']) {
        $fm['id'] = [IO.Path]::GetFileNameWithoutExtension($TaskFilePath)
    }
    $promptText = $null
    if ($fm.Contains('prompt_file') -and $fm['prompt_file']) {
        $promptPath = Join-Path $InboxDir $fm['prompt_file']
        if (Test-Path $promptPath) {
            $promptText = Get-Content -Raw -Path $promptPath -Encoding UTF8
        } else {
            throw "prompt_file '$($fm['prompt_file'])' referenced by $(Split-Path -Leaf $TaskFilePath) does not exist in inbox"
        }
    } else {
        throw "$(Split-Path -Leaf $TaskFilePath) has no prompt_file - the task md must point at a separate prompt file, not embed the prompt inline"
    }
    $files = @()
    if ($fm.Contains('files') -and $fm['files']) {
        $files = @($fm['files'] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
    return [pscustomobject]@{
        Id         = $fm['id']
        CreatedAt  = $(if ($fm.Contains('created_at')) { $fm['created_at'] } else { $null })
        PromptFile = $fm['prompt_file']
        PromptText = $promptText
        Files      = $files
        Cwd        = $(if ($fm.Contains('cwd')) { $fm['cwd'] } else { $null })
        Priority   = $(if ($fm.Contains('priority')) { $fm['priority'] } else { 'normal' })
    }
}

# ---------- Failure classification ----------
# opencode's own docs don't formally document exit codes / 403/429/503 shapes
# for 'run', so this matches on substrings actually observed in stdout/stderr.
# Deliberately broad (multiple patterns per category) since testing surfaces
# more variants over time - extend this list rather than the exception path
# when a new unclassified error shows up.
function Get-FailureCategory {
    param([int]$ExitCode, [string]$StdOut, [string]$StdErr)
    if ($ExitCode -eq 0) { return 'ok' }
    $combined = "$StdOut`n$StdErr"
    if ($ExitCode -eq -1 -or $combined -match 'is not recognized as|command not found|No such file or directory.*opencode') {
        return 'opencode_not_found'
    }
    if ($combined -match '(?i)\b403\b|forbidden') { return 'auth_error' }
    if ($combined -match '(?i)\b429\b|rate.?limit') { return 'rate_limited' }
    if ($combined -match '(?i)\b503\b|service unavailable|overloaded') { return 'provider_error' }
    if ($combined -match '(?i)quota|insufficient (credits|balance)') { return 'quota_exceeded' }
    if ($combined -match 'ProviderModelNotFoundError') { return 'model_not_found' }
    if ($combined -match 'ProviderInitError') { return 'provider_init_error' }
    if ($combined -match 'AI_APICallError') { return 'api_call_error' }
    return 'unknown_error'
}

# 'opencode run --format json' streams newline-delimited JSON events, not one
# blob (confirmed by inspection - the docs only say "raw JSON events").
# Pull out the human-readable reply (type:"text" parts) and the run's actual
# token/cost totals (type:"step_finish" parts) so the result .md shows clean
# text instead of a raw event dump, and so a nonzero cost on a model we
# believe is free is visible immediately rather than buried in the log.
function Get-CleanOutput {
    param([string]$RawStdOut)
    $textParts = @()
    $totalTokens = 0
    $totalCost = 0.0
    foreach ($line in ($RawStdOut -split "`r?`n")) {
        if (-not $line.Trim()) { continue }
        try { $evt = $line | ConvertFrom-Json } catch { continue }
        if ($evt.type -eq 'text' -and $evt.part.text) {
            $textParts += $evt.part.text
        } elseif ($evt.type -eq 'step_finish' -and $evt.part.tokens) {
            $totalTokens += [int]$evt.part.tokens.total
            if ($evt.part.cost) { $totalCost += [double]$evt.part.cost }
        }
    }
    return [pscustomobject]@{
        Text        = ($textParts -join "`n")
        TotalTokens = $totalTokens
        TotalCost   = $totalCost
    }
}

function Invoke-OpenCodeTask {
    param($Task, $Agent, $Ctx)

    $liveIds = Get-LiveFreeCatalogIds -ZenUrl $Ctx.ZenModelsUrl
    $model = Select-LiveModel -Models $Agent.models -LiveIds $liveIds

    if (-not $model) {
        return [ordered]@{
            id            = $Task.Id
            agentId       = $AgentId
            model         = $null
            status        = 'error'
            category      = 'model_unavailable'
            exit_code     = $null
            attached      = $false
            started_at    = (Get-Date).ToString("o")
            finished_at   = (Get-Date).ToString("o")
            duration_sec  = 0
            prompt        = $Task.PromptText
            output        = $null
            tokens_total  = $null
            cost          = $null
            error         = "None of this agent's configured models ($($Agent.models -join ', ')) are present in the live OpenCode Zen catalog ($($Ctx.ZenModelsUrl)) - they've likely rotated out of the free tier. agents.json needs updating."
        }
    }

    # --attach IS CONFIRMED BROKEN on opencode CLI 1.18.16 (Aug 11 2026):
    # 'opencode run --attach <url> ...' exits 0 after only the step_start
    # event and NEVER waits for the actual text/step_finish events - the
    # process returns immediately with no output, reproduced 3/3 times, both
    # from inside Watch-Agent.ps1 and invoked directly. The identical prompt
    # without --attach works correctly every time. This is worse than a
    # visible failure: exit_code 0, status "success", output empty - see the
    # opencode-cli-json-and-free-tier-gotchas skill. Forced to $false until
    # a newer opencode version is confirmed to fix this; re-enabling this
    # (attach = Test-BridgeServerHealthy ...) without re-verifying end-to-end
    # (not just the health endpoint - a REAL run with real output) will
    # silently break every task again.
    $attach = $false
    $serverHealthy = Test-BridgeServerHealthy -ServerUrl $Ctx.ServerUrl
    if (-not $serverHealthy) {
        Add-AlertThrottled -Category 'bridge_server_down' `
            -Detail "Shared opencode serve at $($Ctx.ServerUrl) unreachable (informational only right now - --attach is disabled regardless pending the CLI bug above, every task already runs standalone)." `
            -ThrottleMinutes $Ctx.AlertThrottleMin
    }

    $argsList = @("run", "--format", "json")
    if ($attach) { $argsList += @("--attach", $Ctx.ServerUrl) }
    $argsList += @("-m", $model)
    if ($Agent.opencodeAgent) { $argsList += @("--agent", $Agent.opencodeAgent) }
    if ($Agent.autoApprove) { $argsList += "--auto" }
    foreach ($f in $Task.Files) { $argsList += @("-f", $f) }
    if ($Task.Cwd) { $argsList += @("--dir", $Task.Cwd) }
    $argsList += @("--title", "bridge-$AgentId-$($Task.Id)")
    $argsList += [string]$Task.PromptText

    $stdOutPath = Join-Path $TaskLogsDir "$($Task.Id).stdout.log"
    $stdErrPath = Join-Path $TaskLogsDir "$($Task.Id).stderr.log"

    $start = Get-Date
    $exitCode = 0
    try {
        # Resolve the known install location first rather than trusting a bare
        # 'opencode' on PATH - PATH updates (e.g. right after installing
        # OpenCode) don't reach already-running processes, and Task
        # Scheduler-launched processes have occasionally been seen not to
        # pick up a just-updated user PATH either.
        $exe = Join-Path $env:USERPROFILE ".opencode\bin\opencode.exe"
        if (-not (Test-Path $exe)) {
            # Native-installer layout absent (npm global install instead,
            # e.g. under C:\Program Files\nodejs\ or %APPDATA%\npm\) - npm's
            # own extension-less 'opencode' shim on PATH is a POSIX shell
            # script with no valid Win32 header, so handing it straight to
            # Start-Process fails with "%1 is not a valid Win32 application"
            # (confirmed 2026-08-14, this machine). Resolve the shim's own
            # directory and look for the real PE binary nested underneath it
            # instead of trusting the bare name.
            $shim = Get-Command opencode -ErrorAction SilentlyContinue
            $exe = $null
            if ($shim) {
                $nested = Join-Path (Split-Path $shim.Source -Parent) "node_modules\opencode-ai\bin\opencode.exe"
                if (Test-Path $nested) { $exe = $nested }
            }
            if (-not $exe) { $exe = "opencode.cmd" }  # CMD shim re-execs node correctly, unlike the bare shim
        }
        $proc = Start-Process -FilePath $exe -ArgumentList $argsList `
            -NoNewWindow -Wait -PassThru `
            -RedirectStandardOutput $stdOutPath -RedirectStandardError $stdErrPath
        $exitCode = $proc.ExitCode
    } catch {
        Set-Content -Path $stdErrPath -Value "$_"
        $exitCode = -1
    }
    $finish = Get-Date

    $stdout = ""; $stderr = ""
    if (Test-Path $stdOutPath) { $stdout = Get-Content -Raw -Path $stdOutPath -ErrorAction SilentlyContinue }
    if (Test-Path $stdErrPath) { $stderr = Get-Content -Raw -Path $stdErrPath -ErrorAction SilentlyContinue }

    $category = Get-FailureCategory -ExitCode $exitCode -StdOut $stdout -StdErr $stderr
    $clean = if ($category -eq 'ok') { Get-CleanOutput -RawStdOut $stdout } else { $null }

    # Defense in depth against the --attach bug above (or any other cause of
    # the same symptom): exit 0 with no actual text is NOT a success, no
    # matter what the exit code says. Catching this here means a future
    # regression (CLI update, --attach re-enabled, some other silent
    # truncation) gets caught as a visible error instead of quietly
    # reported as success with an empty result.md.
    if ($category -eq 'ok' -and [string]::IsNullOrWhiteSpace($clean.Text)) {
        $category = 'empty_response'
    }
    $statusText = if ($category -eq 'ok') { 'success' } else { 'error' }

    if ($category -ne 'ok') {
        Add-AlertThrottled -Category $category `
            -Detail "model=$model task=$($Task.Id) exit=$exitCode - $(($stderr, $stdout | Where-Object {$_}) -join ' | ' | Select-Object -First 1)" `
            -ThrottleMinutes $Ctx.AlertThrottleMin
    } elseif ($clean.TotalCost -gt 0) {
        # This model is configured because it's supposed to be free. A nonzero
        # cost means it's quietly left the free tier - worth knowing before
        # real spend accumulates unnoticed across a burst of queued tasks.
        Add-AlertThrottled -Category 'unexpected_cost' `
            -Detail "model=$model task=$($Task.Id) reported cost=$($clean.TotalCost) even though this model is configured as free - check 'opencode models opencode --verbose' and update agents.json if it has left the free tier." `
            -ThrottleMinutes $Ctx.AlertThrottleMin
    }

    return [ordered]@{
        id            = $Task.Id
        agentId       = $AgentId
        model         = $model
        status        = $statusText
        category      = $category
        exit_code     = $exitCode
        attached      = $attach
        started_at    = $start.ToString("o")
        finished_at   = $finish.ToString("o")
        duration_sec  = [math]::Round(($finish - $start).TotalSeconds, 2)
        prompt        = $Task.PromptText
        output        = $(if ($clean) { $clean.Text } else { $stdout })
        tokens_total  = $(if ($clean) { $clean.TotalTokens } else { $null })
        cost          = $(if ($clean) { $clean.TotalCost } else { $null })
        error         = $(if ($category -ne 'ok') { $stderr } else { $null })
    }
}

function Write-ResultMd {
    param($Result, [string]$OutPath)
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine("id: $($Result.id)")
    [void]$sb.AppendLine("agent_id: $($Result.agentId)")
    [void]$sb.AppendLine("model: $($Result.model)")
    [void]$sb.AppendLine("status: $($Result.status)")
    [void]$sb.AppendLine("category: $($Result.category)")
    [void]$sb.AppendLine("exit_code: $($Result.exit_code)")
    [void]$sb.AppendLine("attached: $($Result.attached)")
    [void]$sb.AppendLine("started_at: $($Result.started_at)")
    [void]$sb.AppendLine("finished_at: $($Result.finished_at)")
    [void]$sb.AppendLine("duration_sec: $($Result.duration_sec)")
    [void]$sb.AppendLine("tokens_total: $($Result.tokens_total)")
    [void]$sb.AppendLine("cost: $($Result.cost)")
    [void]$sb.AppendLine('---')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('## Prompt')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('```')
    [void]$sb.AppendLine($Result.prompt)
    [void]$sb.AppendLine('```')
    [void]$sb.AppendLine('')
    if ($Result.status -eq 'success') {
        [void]$sb.AppendLine('## Output')
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine($Result.output)
    } else {
        [void]$sb.AppendLine('## Error')
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine('category: `' + $Result.category + '`')
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine('```')
        [void]$sb.AppendLine($(if ($Result.error) { $Result.error } else { '(no stderr captured)' }))
        [void]$sb.AppendLine('```')
        if ($Result.output) {
            [void]$sb.AppendLine('')
            [void]$sb.AppendLine('### stdout (may still be useful even on failure)')
            [void]$sb.AppendLine('')
            [void]$sb.AppendLine('```')
            [void]$sb.AppendLine($Result.output)
            [void]$sb.AppendLine('```')
        }
    }
    Set-Content -Path $OutPath -Value $sb.ToString() -Encoding UTF8
}

$Script:StartedAt = (Get-Date).ToString("o")
Write-Log "Watcher starting for agent '$AgentId' (PID $PID)"

while ($true) {
    try {
        $ctx   = Get-AgentConfig
        $agent = $ctx.Agent
        $poll  = $ctx.PollIntervalSec

        Write-Heartbeat -Agent $agent -PollIntervalSec $poll

        if ($agent.enabled -eq $false) {
            Start-Sleep -Seconds $poll
            continue
        }

        # Only pick up task descriptors (.md), never their paired .prompt.md files
        $next = Get-ChildItem -Path $InboxDir -Filter "*.md" -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notlike '*.prompt.md' } |
            Sort-Object CreationTimeUtc | Select-Object -First 1

        if ($next) {
            $pendingPath = Join-Path $PendingDir $next.Name
            Move-Item -Path $next.FullName -Destination $pendingPath -Force

            try {
                $task = Get-TaskFromFile -TaskFilePath $pendingPath -InboxDir $InboxDir
                if ($task.PromptFile) {
                    $srcPrompt = Join-Path $InboxDir $task.PromptFile
                    if (Test-Path $srcPrompt) {
                        Move-Item -Path $srcPrompt -Destination (Join-Path $PendingDir $task.PromptFile) -Force
                    }
                }

                Write-Log "Processing task $($task.Id)"
                $result = Invoke-OpenCodeTask -Task $task -Agent $agent -Ctx $ctx

                $resultPath = Join-Path $OutboxDir "$($task.Id).result.md"
                Write-ResultMd -Result $result -OutPath $resultPath

                Add-Notification -Record @{
                    ts       = (Get-Date).ToString("o")
                    agentId  = $AgentId
                    taskId   = $task.Id
                    status   = $result.status
                    category = $result.category
                    outbox   = "agents/$AgentId/outbox/$($task.Id).result.md"
                }

                Remove-Item -Path $pendingPath -Force -ErrorAction SilentlyContinue
                if ($task.PromptFile) {
                    Remove-Item -Path (Join-Path $PendingDir $task.PromptFile) -Force -ErrorAction SilentlyContinue
                }
                Write-Log "Finished task $($task.Id) with status $($result.status) [$($result.category)]"
            }
            catch {
                $failId = [IO.Path]::GetFileNameWithoutExtension($next.Name)
                Write-Log "ERROR processing $($next.Name): $_"
                $errResult = [ordered]@{
                    id            = $failId
                    agentId       = $AgentId
                    model         = $null
                    status        = 'error'
                    category      = 'malformed_task'
                    exit_code     = $null
                    attached      = $false
                    started_at    = (Get-Date).ToString("o")
                    finished_at   = (Get-Date).ToString("o")
                    duration_sec  = 0
                    prompt        = "(could not parse task file)"
                    output        = $null
                    tokens_total  = $null
                    cost          = $null
                    error         = "$_"
                }
                $errPath = Join-Path $OutboxDir "$failId.result.md"
                Write-ResultMd -Result $errResult -OutPath $errPath
                Add-Notification -Record @{
                    ts       = (Get-Date).ToString("o")
                    agentId  = $AgentId
                    taskId   = $failId
                    status   = 'error'
                    category = 'malformed_task'
                    outbox   = "agents/$AgentId/outbox/$failId.result.md"
                }
                Add-AlertThrottled -Category 'malformed_task' -Detail "$($next.Name): $_" -ThrottleMinutes $ctx.AlertThrottleMin
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
