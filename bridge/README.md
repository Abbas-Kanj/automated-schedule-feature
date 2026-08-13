# OpenCode Agents Bridge

A file-based bridge that lets Claude Code delegate tasks to local [OpenCode](https://opencode.ai)
agents running free-tier models via OpenCode Zen, and pick up their results
asynchronously.

Full protocol details (how Claude checks agent status, delegates, and reads
results) live in the `opencode-agents-bridge` skill. This file only covers
one-time human setup.

## Layout

```
bridge/
  config/agents.json        registry of agents (id, models[] priority-ordered
                             fallback chain, tags, enabled) + shared server config
  agents/<agent-id>/
    inbox/                   task descriptor <id>.md + paired <id>.prompt.md
                             dropped here get picked up (NOT one JSON file -
                             the descriptor's prompt_file field points AT the
                             prompt file, it doesn't embed the prompt inline)
    pending/                 in-flight task's file pair (moved here while running)
    outbox/                  <task-id>.result.md written here when done -
                             plain markdown: frontmatter + Prompt/Output/Error
                             sections, not JSON
    logs/
      status.json            heartbeat (proves the watcher is alive)
      watcher.log             rolling watcher activity log
      notifications.jsonl     one line per finished task (this agent only)
      alerts.jsonl            throttled, one line per (failure category) per
                             alertThrottleMinutes - the "check this without
                             being interrupted" channel: model rotated out of
                             the free tier, rate limited, shared server down,
                             a free model unexpectedly reporting nonzero cost
      tasks/<task-id>.*.log   raw stdout/stderr per task (full NDJSON event
                             stream from 'opencode run --format json' - the
                             result .md only shows the extracted clean text)
  notifications.jsonl        one line per finished task, ALL agents combined
  alerts.jsonl                one line per throttled alert, ALL agents combined
  scripts/
    Watch-Agent.ps1          the watcher itself (one instance per agent) -
                             health-checks the LIVE OpenCode Zen catalog
                             before firing, walks each agent's models[]
                             fallback chain to the first one still present.
                             --attach to the shared server is CURRENTLY
                             DISABLED (confirmed broken on opencode CLI
                             1.18.16 - see opencode-cli-json-and-free-tier-
                             gotchas) - every task runs standalone. Hides its
                             own console window on startup (Win32
                             ShowWindow) rather than via a launch wrapper.
    Register-Watchers.ps1    registers this project's Task Scheduler entries
                             (task names prefixed with projectSlug from
                             config\agents.json, so they never collide with
                             another project's) - calls powershell.exe
                             directly, no hidden-launch wrapper (see
                             vbs-trampoline-orphans-tracked-process for why
                             that approach was tried first and is a bug, not
                             a style choice - it silently breaks
                             Stop-ScheduledTask)
    Unregister-Watchers.ps1  removes this project's Scheduled Tasks only -
                             never touches the shared server, other projects
                             may still depend on it
    Get-AgentStatus.ps1      prints ACTIVE / STALE / OFFLINE per agent + a
                             live health check against the shared server,
                             plus the last 10 alerts
    Send-Task.ps1            manually queue a test task (writes the
                             descriptor + prompt file pair)
```

**The shared `opencode serve` instance is NOT in this folder.** It's
machine-wide, at `~\.claude\opencode-bridge-server\`, registered once per
machine (not per project) and shared by every project's bridge — see that
folder's own scripts (`Register-Server.ps1`, `Get-ServerStatus.ps1`, etc.).
This project's `config\agents.json` `server` block just points at it
(port/hostname) — it must match `~\.claude\opencode-bridge-server\
config.json` exactly. This project, and the reusable template for setting
up a bridge in a *new* project, both live under the `opencode-agents-bridge`
global skill (`~/.claude/skills/opencode-agents-bridge/assets/bridge-
template/`) — check there before rebuilding any of this from scratch
elsewhere.

## One-time setup

1. **Install OpenCode** (native Windows or WSL - native is what the watchers
   below assume):
   ```
   curl -fsSL https://opencode.ai/install | bash
   ```
   or see https://opencode.ai/docs/ for the Windows installer/npm/scoop
   options. The installer only prints a bash PATH hint - on Windows, also add
   `%USERPROFILE%\.opencode\bin` to your **persistent user PATH** (System
   Properties → Environment Variables), not just the current shell, since
   Task Scheduler-launched watchers need it too. Open a **fresh** terminal
   afterward - an already-running terminal app won't see the update.

2. **Authenticate**:
   ```
   opencode auth login
   ```
   Select **OpenCode Zen** (not a per-provider DeepSeek/Qwen/GLM/Moonshot
   account) - one Zen credential covers every model in `config\agents.json`,
   since they're all `opencode/*`-namespaced.

3. **Confirm the free models are still current**:
   ```
   opencode models --refresh
   opencode models opencode --verbose   # shows cost per model - free = cost.input/output both 0
   ```
   Free models on Zen are explicitly time-limited and rotate without notice.
   `config\agents.json`'s `models` arrays are priority-ordered fallback
   chains verified working as of Aug 11, 2026 - Watch-Agent.ps1 re-checks the
   **live** catalog (`https://opencode.ai/zen/v1/models`, not the CLI's own
   cache, which has been observed to lag behind it) before every task, so
   day-to-day rotation is handled automatically. Only touch this file
   yourself if an agent's entire fallback chain has rotated out (visible via
   `alerts.jsonl`, category `model_unavailable`) - re-run the verbose check,
   confirm cost is still 0/0, and **smoke-test with a real `opencode run`**
   before adding a new model (the live catalog can list a model before the
   CLI's own provider registry actually resolves it - catalog presence alone
   isn't enough, see `config\agents.json`'s `_notes`).

4. **Make sure the machine-wide shared server is running** (once per
   machine, not per project — skip if another project already set this up):
   ```powershell
   cd ~\.claude\opencode-bridge-server\scripts
   .\Register-Server.ps1   # elevated PowerShell window
   .\Get-ServerStatus.ps1  # should show ACTIVE
   ```

5. **Register this project's watchers** (run from `bridge\scripts\`, and
   from an **elevated** PowerShell window - "Run as Administrator" - even
   for a non-admin `AtLogOn` trigger; on at least one machine
   `Register-ScheduledTask` throws Access Denied non-elevated despite
   Microsoft's docs saying that shouldn't be necessary):
   ```powershell
   cd bridge\scripts
   .\Register-Watchers.ps1
   ```
   This registers one Task Scheduler task per enabled agent
   (`OpenCodeBridge-<projectSlug>-<agent-id>`), starts them all immediately,
   and configures them to restart automatically at logon and after a crash.

6. **Verify they're alive**:
   ```powershell
   .\Get-AgentStatus.ps1
   ```
   You should see the shared server and every enabled agent as `ACTIVE`
   within a few seconds, plus any recent alerts.

7. **Smoke test** (optional):
   ```powershell
   .\Send-Task.ps1 -AgentId deepseek-worker -PromptText "Reply with just the word: pong"
   ```
   Then check `agents\deepseek-worker\outbox\` for the `.result.md` file a
   few seconds later.

## Adding/removing agents

Edit `config\agents.json`, then re-run `Register-Watchers.ps1` (elevated; it
unregisters and re-registers every task, safe to re-run anytime - also the
way to pick up script changes, since a running Scheduled Task doesn't
auto-reload edited `.ps1` files). Set `"enabled": false` to pause an agent
without deleting it.

## Notes

- Watchers run native Windows PowerShell. `Invoke-OpenCodeTask` resolves
  `opencode.exe` at its well-known install path
  (`%USERPROFILE%\.opencode\bin\opencode.exe`) first and only falls back to
  a bare `opencode` PATH lookup, specifically because PATH updates don't
  reach already-running processes. If you installed OpenCode inside WSL
  instead, either add a wrapper `opencode.cmd` on the Windows PATH that
  shells out to `wsl opencode "$@"`, or switch to running under WSL/Task
  Scheduler with a bash action - ask Claude to adapt the scripts if you go
  this route.
- `Register-Watchers.ps1` registers tasks that start **at logon of the
  current user**. If you need them running while logged off, edit the task
  in Task Scheduler GUI to "Run whether user is logged on or not" (requires
  storing your Windows password in the task).
- All 4 agents currently point at **free-tier OpenCode Zen models only** -
  no paid spend expected. `Watch-Agent.ps1` still checks the actual reported
  `cost` on every successful run and raises an `unexpected_cost` alert if a
  configured-free model ever reports nonzero cost, as an early warning that
  it's quietly left the free tier.
