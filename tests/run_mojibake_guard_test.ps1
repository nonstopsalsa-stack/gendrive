[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Running Mojibake Guard Test Suite (tests/test_mojibake_guard.js)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. node.exe の探索
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

# 2. 本番ガードテスト実行
$scriptPath = Join-Path $PSScriptRoot "test_mojibake_guard.js"
& $nodePath $scriptPath "."
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Mojibake Guard detected violations in codebase!" -ForegroundColor Red
    exit 1
}
Write-Host "[PASS] Normal scan passed completely." -ForegroundColor Green

# 3. 反証テスト（Falsification Test）
Write-Host "`n----------------------------------------------------------" -ForegroundColor Cyan
Write-Host " Running Falsification Verification (Testing False Negative Prevention)" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Cyan

$tempDummyFile = Join-Path $PSScriptRoot "temp_falsification_dummy.js"
try {
    # 意図的に化け文字列と破壊テンプレートを混入
    $dummyContent = @"
// Falsification dummy line
const corruptedMsg = "譌･莉倥↑縺・";
const corruptedTemplate = `{task.title} failed`;
"@
    [System.IO.File]::WriteAllText($tempDummyFile, $dummyContent, [System.Text.Encoding]::UTF8)

    # ガードテストを実行し、エラーが検出されることを検証
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $falsificationOutput = & $nodePath $scriptPath "." 2>&1
    $falsificationExitCode = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP

    if ($falsificationExitCode -eq 0) {
        Write-Host "[FAIL] Falsification failed! Guard did NOT detect intentionally injected mojibake!" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "[PASS] Falsification passed! Guard successfully detected injected mojibake and failed as expected (Exit Code: $falsificationExitCode)." -ForegroundColor Green
    }
}
finally {
    if (Test-Path $tempDummyFile) {
        Remove-Item -Path $tempDummyFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " SUCCESS: ALL MOJIBAKE GUARD TESTS & FALSIFICATION PASSED!" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
exit 0
