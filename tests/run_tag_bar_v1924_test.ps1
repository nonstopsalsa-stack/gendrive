[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Running Tag Bar & Mojibake Verification Suite" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$nodePath = "node"
$nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    $candidates = @(
        "C:\Users\nonst\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe",
        "C:\Program Files\nodejs\node.exe",
        "C:\Program Files (x86)\nodejs\node.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $nodePath = $c
            break
        }
    }
} else {
    $nodePath = $nodeCmd.Source
}

Write-Host "Using Node engine: $nodePath" -ForegroundColor Gray

$scriptPath = Join-Path $PSScriptRoot "test_tag_bar_v1924.js"
& $nodePath $scriptPath
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host "`n[FAIL] Tag Bar verification suite failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[PASS] Tag Bar verification suite passed successfully!" -ForegroundColor Green
exit 0
