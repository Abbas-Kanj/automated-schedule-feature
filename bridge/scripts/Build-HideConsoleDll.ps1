<#
.SYNOPSIS
    Builds HideConsole.dll - the precompiled Win32 console-hide helper used
    by Watch-Agent.ps1's startup self-hide step.

.DESCRIPTION
    Watch-Agent.ps1 used to compile this P/Invoke shim from inline C# via
    `Add-Type -MemberDefinition` on every single watcher startup. That's
    fine for one watcher, but a session start fires every enabled agent's
    task at once (12+ across a couple of projects, easily 13+ machine-wide)
    - csc.exe's cold-start cost multiplied by that many concurrent
    compiles was slow enough that the console window was genuinely visible
    (not just a sub-second flash) for several seconds before ShowWindow
    finally fired, landing in Alt-Tab/Task View screenshots and needing to
    be manually closed. Confirmed 2026-08-17.

    Fix: compile this once, ship the .dll alongside Watch-Agent.ps1, and
    have it `Add-Type -Path` (a plain assembly load, no compiler involved)
    instead of compiling from source at every startup. Watch-Agent.ps1 still
    falls back to compiling inline if HideConsole.dll is missing, so a
    project copied without its scripts folder still degrades gracefully
    (just back to the slow path) rather than failing outright.

    Re-run this any time HideConsole.dll needs rebuilding (shouldn't be
    often - it's a trivial, stable Win32 shim). Copy the resulting .dll into
    every bridge's scripts\ folder (template + every project that has its
    own bridge\scripts\ copy) - it's a plain file, not something that can be
    symlinked across drives reliably, so it has to be copied to each.

.EXAMPLE
    cd <bridge-template-or-project>\scripts
    .\Build-HideConsoleDll.ps1
    # then copy the resulting HideConsole.dll to every other bridge's scripts\ folder
#>
param(
    [string]$OutputPath = (Join-Path $PSScriptRoot "HideConsole.dll")
)

$src = @'
using System;
using System.Runtime.InteropServices;

namespace BridgeConsole
{
    public static class Window
    {
        [DllImport("kernel32.dll")]
        public static extern IntPtr GetConsoleWindow();

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        public static void Hide()
        {
            IntPtr h = GetConsoleWindow();
            if (h != IntPtr.Zero) { ShowWindow(h, 0); } // 0 = SW_HIDE
        }
    }
}
'@

Add-Type -TypeDefinition $src -OutputAssembly $OutputPath -OutputType Library
Write-Host "Built $OutputPath"

# Smoke test: load it back in a fresh process and confirm the type resolves.
$check = powershell -NoProfile -Command "Add-Type -Path '$OutputPath'; [BridgeConsole.Window]::Hide(); 'ok'"
if ($check -ne 'ok') { throw "Smoke test failed - HideConsole.dll did not load/run cleanly." }
Write-Host "Smoke test passed."
