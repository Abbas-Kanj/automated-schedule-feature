<#
.SYNOPSIS
    Manually drops a task descriptor + prompt file pair into an agent's
    inbox. Useful for testing the bridge end-to-end. Claude normally writes
    these files directly instead of calling this script.

.DESCRIPTION
    Writes two files per task, not one JSON blob:
      inbox\<id>.md          - small frontmatter descriptor (metadata only)
      inbox\<id>.prompt.md   - the actual prompt text
    The descriptor's 'prompt_file' field POINTS AT the prompt file; it does
    not contain the prompt itself. This keeps the inbox scannable (skim the
    .md descriptors to see what's queued) without wading through long prompt
    text, and lets a prompt be authored/edited directly as a plain text file.

.PARAMETER PromptText
    Inline prompt text - written out to a generated .prompt.md file for you.
    Use this OR -PromptFile, not both.

.PARAMETER PromptFile
    Path to an existing .md/.txt file with the prompt already written out -
    copied into the inbox as the paired prompt file. Use this OR
    -PromptText, not both.

.EXAMPLE
    .\Send-Task.ps1 -AgentId deepseek-worker -PromptText "Say hello in one sentence."
    .\Send-Task.ps1 -AgentId qwen-coder -PromptFile .\my-refactor-request.md -Files src\foo.ts
#>
param(
    [Parameter(Mandatory=$true)][string]$AgentId,
    [string]$PromptText,
    [string]$PromptFile,
    [string]$BridgeRoot = (Split-Path -Parent $PSScriptRoot),
    [string[]]$Files,
    [string]$Cwd,
    [string]$Priority = "normal"
)

if (-not $PromptText -and -not $PromptFile) {
    throw "Provide either -PromptText or -PromptFile"
}
if ($PromptText -and $PromptFile) {
    throw "Provide only one of -PromptText or -PromptFile, not both"
}

$InboxDir = Join-Path $BridgeRoot "agents\$AgentId\inbox"
if (-not (Test-Path $InboxDir)) { throw "No such agent inbox: $InboxDir" }

$taskId = [guid]::NewGuid().ToString()
$promptFileName = "$taskId.prompt.md"
$promptDestPath = Join-Path $InboxDir $promptFileName

if ($PromptFile) {
    if (-not (Test-Path $PromptFile)) { throw "PromptFile not found: $PromptFile" }
    Copy-Item -Path $PromptFile -Destination $promptDestPath -Force
} else {
    Set-Content -Path $promptDestPath -Value $PromptText -Encoding UTF8
}

$filesLine = if ($Files) { ($Files -join ', ') } else { '' }

$descriptor = @"
---
id: $taskId
created_at: $((Get-Date).ToString("o"))
prompt_file: $promptFileName
files: $filesLine
cwd: $Cwd
priority: $Priority
---
"@

$descriptorPath = Join-Path $InboxDir "$taskId.md"
Set-Content -Path $descriptorPath -Value $descriptor -Encoding UTF8

Write-Host "Task $taskId queued for agent '$AgentId'"
Write-Host "  descriptor: agents\$AgentId\inbox\$taskId.md"
Write-Host "  prompt:     agents\$AgentId\inbox\$promptFileName"
Write-Host "Result will appear at agents\$AgentId\outbox\$taskId.result.md"
