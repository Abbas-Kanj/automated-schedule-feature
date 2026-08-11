# OpenCode Agents Bridge

A file-based bridge that lets Claude Code delegate tasks to local [OpenCode](https://opencode.ai)
agents running cheaper/alternate models, and pick up their results asynchronously.

Full protocol details (how Claude checks agent status, delegates, and reads
results) live in the `opencode-agents-bridge` skill. This file only covers
one-time human setup.

## Layout

```
bridge/
  config/agents.json        registry of agents (id, model, tags, enabled)
  agents/<agent-id>/
    inbox/                   task JSON files dropped here get picked up
    pending/                 in-flight task (moved here while running)
    outbox/                  <task-id>.result.json written here when done
    logs/
      status.json            heartbeat (proves the watcher is alive)
      watcher.log             rolling watcher activity log
      notifications.jsonl     one line per finished task (this agent only)
      tasks/<task-id>.*.log   raw stdout/stderr per task
  notifications.jsonl        one line per finished task, ALL agents combined
  scripts/
    Watch-Agent.ps1          the watcher itself (one instance per agent)
    Register-Watchers.ps1    registers a Task Scheduler entry per enabled agent
    Unregister-Watchers.ps1  removes them
    Get-AgentStatus.ps1      prints ACTIVE / STALE / OFFLINE per agent
    Send-Task.ps1            manually queue a test task
```

## One-time setup

1. **Install OpenCode** (native Windows or WSL - native is what the watchers
   below assume):
   ```
   curl -fsSL https://opencode.ai/install | bash
   ```
   or see https://opencode.ai/docs/ for the Windows installer/npm/scoop options.

2. **Authenticate the providers you want to use**:
   ```
   opencode auth login
   ```
   Repeat per provider (DeepSeek, Qwen/OpenRouter, Zhipu/GLM, Moonshot/Kimi, etc).

3. **Confirm the exact model names available to you**:
   ```
   opencode models
   ```
   The `model` fields in `config\agents.json` are reasonable Aug-2026 defaults
   but provider/model strings change - fix them up if `opencode models` shows
   something different. No script edits are needed elsewhere; watchers reread
   this file every loop tick.

4. **Register the watchers** (run from `scripts\`):
   ```powershell
   cd bridge\scripts
   .\Register-Watchers.ps1
   ```
   This creates one Windows Task Scheduler task per enabled agent
   (`OpenCodeBridge-<agent-id>`), starts it immediately, and configures it to
   restart automatically at logon and after a crash.

5. **Verify they're alive**:
   ```powershell
   .\Get-AgentStatus.ps1
   ```
   You should see `ACTIVE` for every enabled agent within a few seconds.

6. **Smoke test** (optional):
   ```powershell
   .\Send-Task.ps1 -AgentId deepseek-worker -Prompt "Reply with just the word: pong"
   ```
   Then check `agents\deepseek-worker\outbox\` for the result file a few
   seconds later.

## Adding/removing agents

Edit `config\agents.json`, then re-run `Register-Watchers.ps1` (it
unregisters and re-registers every enabled agent's task, safe to re-run
anytime). Set `"enabled": false` to pause an agent without deleting it.

## Notes

- Watchers run native Windows PowerShell and call `opencode` directly (must
  be on PATH). If you installed OpenCode inside WSL instead, either add a
  wrapper `opencode.cmd` on the Windows PATH that shells out to
  `wsl opencode "$@"`, or switch to running under WSL/Task Scheduler with a
  bash action - ask Claude to adapt the scripts if you go this route.
- `Register-Watchers.ps1` registers tasks that start **at logon of the
  current user**. If you need them running while logged off, edit the task
  in Task Scheduler GUI to "Run whether user is logged on or not" (requires
  storing your Windows password in the task).
