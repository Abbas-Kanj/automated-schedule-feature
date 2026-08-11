<#
.SYNOPSIS
    Manually drops a task JSON file into an agent's inbox. Useful for
    testing the bridge end-to-end. Claude normally writes these files
    directly instead of calling this script.

.EXAMPLE
    .\Send-Task.ps1 -AgentId deepseek-worker -Prompt "Say hello in one sentence."
#>
param(
    [Parameter(Mandatory=$true)][string]$AgentId,
    [Parameter(Mandatory=$true)][string]$Prompt,
    [string]$BridgeRoot = (Split-Path -Parent $PSScriptRoot),
    [string[]]$Files,
    [string]$Cwd
)

$InboxDir = Join-Path $BridgeRoot "agents\$AgentId\inbox"
if (-not (Test-Path $InboxDir)) { throw "No such agent inbox: $InboxDir" }

$taskId = [guid]::NewGuid().ToString()
$task = [ordered]@{
    id         = $taskId
    created_at = (Get-Date).ToString("o")
    prompt     = $Prompt
    files      = $Files
    cwd        = $Cwd
    priority   = "normal"
}

$path = Join-Path $InboxDir "$taskId.json"
$task | ConvertTo-Json -Depth 5 | Set-Content -Path $path -Encoding UTF8

Write-Host "Task $taskId queued for agent '$AgentId'"
Write-Host "Result will appear at agents\$AgentId\outbox\$taskId.result.json"
