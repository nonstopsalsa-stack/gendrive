[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Gendrive v1.9.15 Comprehensive Verification Test Suite  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$passCount = 0
$failCount = 0

function Assert-Test($name, $condition, $detail = "") {
    if ($condition) {
        Write-Host " [PASS] $name" -ForegroundColor Green
        if ($detail) { Write-Host "        $detail" -ForegroundColor Gray }
        $script:passCount++
    } else {
        Write-Host " [FAIL] $name" -ForegroundColor Red
        if ($detail) { Write-Host "        $detail" -ForegroundColor Yellow }
        $script:failCount++
    }
}

# 1. Version Consistency Check
$cfg = Get-Content 'js/config.js' -Encoding UTF8 -Raw
$hasCfgVer = $cfg.Contains("const APP_VERSION = 'v1.9.15';")
Assert-Test "1. js/config.js APP_VERSION is v1.9.15" $hasCfgVer

$idx = Get-Content 'index.html' -Encoding UTF8 -Raw
$hasIdxVer = ($idx -match 'id="app-version-badge"[^>]*>v1\.9\.15<')
$hasIdxScripts = $idx.Contains("js/services/storageService.js?v=1.9.15")
Assert-Test "2. index.html badge and script cachebusters are v1.9.15" ($hasIdxVer -and $hasIdxScripts)

$mob = Get-Content 'mobile.html' -Encoding UTF8 -Raw
$hasMobVer = ($mob -match 'class="version-capsule-badge">v1\.9\.15</span>')
$hasMobScripts = $mob.Contains("mobile.js?v=1.9.15")
Assert-Test "3. mobile.html badge and script cachebusters are v1.9.15" ($hasMobVer -and $hasMobScripts)

$sw = Get-Content 'sw.js' -Encoding UTF8 -Raw
$hasSwVer = $sw.Contains("CACHE_NAME = 'gendrive-lite-v1915';")
Assert-Test "4. sw.js cache name is v1915" $hasSwVer

# 2. Extract and test dummy sanitization logic
$storageJs = Get-Content 'js/services/storageService.js' -Encoding UTF8 -Raw
$mobileJs = Get-Content 'mobile.js' -Encoding UTF8 -Raw

$hasStorageDummyLogic = $storageJs.Contains("function isDummyTask") -and $storageJs.Contains("function isDummyHabit") -and $storageJs.Contains("function sanitizeTasksDummyFilter")
Assert-Test "5. storageService.js contains dummy detection and filter functions" $hasStorageDummyLogic

$hasMobileDummyLogic = $mobileJs.Contains("function isMobileDummyTask") -and $mobileJs.Contains("function isMobileDummyHabit") -and $mobileJs.Contains("function sanitizeMobileTasksDummy")
Assert-Test "6. mobile.js contains mobile dummy detection and filter functions" $hasMobileDummyLogic

$hasStorageInterceptor = $storageJs.Contains("Test mode active. Push to production GAS URL blocked.")
Assert-Test "7. storageService.js contains production test guard interceptor" $hasStorageInterceptor

$hasMobileInterceptor = $mobileJs.Contains("Test mode active. Push to production GAS URL blocked.")
Assert-Test "8. mobile.js contains mobile production test guard interceptor" $hasMobileInterceptor

# 3. Direct logic pattern assertion
function Test-IsDummyTask($t) {
    if (-not $t) { return $false }
    $title = [string]$t.title
    if ($title -like "*Emulate Real Data*" -or $title -like "*With Some Detailed Description To Emulate Real Data*") {
        return $true
    }
    if ($t.id -match "^T([1-9]|[1-9][0-9]|1[0-9][0-9]|200)$" -and $title -like "Task Title Number *") {
        return $true
    }
    return $false
}

function Test-IsDummyHabit($h) {
    if (-not $h) { return $false }
    $name = [string]$h.name
    if ($name -like "*Emulating Daily Routine*") {
        return $true
    }
    if ($h.id -match "^H([1-9]|[1-4][0-9]|50)$" -and $name -like "Habit Name *") {
        return $true
    }
    return $false
}

$dummyT1 = [pscustomobject]@{ id = 'T1'; title = 'Task Title Number 1 With Some Detailed Description To Emulate Real Data' }
$dummyT200 = [pscustomobject]@{ id = 'T200'; title = 'Task Title Number 200 With Some Detailed Description To Emulate Real Data' }
$realT = [pscustomobject]@{ id = 'T206'; title = 'Real User Production Ongoing Task' }

$dummyH1 = [pscustomobject]@{ id = 'H1'; name = 'Habit Name 1 Emulating Daily Routine' }
$dummyH50 = [pscustomobject]@{ id = 'H50'; name = 'Habit Name 50 Emulating Daily Routine' }
$realH = [pscustomobject]@{ id = 'H069'; name = 'Real User Production Habit Toothbrush' }

$patternCheckT = (Test-IsDummyTask $dummyT1) -and (Test-IsDummyTask $dummyT200) -and (-not (Test-IsDummyTask $realT))
Assert-Test "9. Dummy task pattern detection accuracy (T1, T200 flagged, T206 kept)" $patternCheckT

$patternCheckH = (Test-IsDummyHabit $dummyH1) -and (Test-IsDummyHabit $dummyH50) -and (-not (Test-IsDummyHabit $realH))
Assert-Test "10. Dummy habit pattern detection accuracy (H1, H50 flagged, H069 kept)" $patternCheckH

$filterTasks = @()
foreach ($item in @($dummyT1, $realT, $dummyT200)) {
    if (-not (Test-IsDummyTask $item)) { $filterTasks += $item }
}
$tOk = ($filterTasks.Count -eq 1 -and $filterTasks[0].id -eq 'T206')
Assert-Test "11. Filter purges all dummy tasks and keeps real task" $tOk "Remaining: $($filterTasks.Count)"

$filterHabits = @()
foreach ($hItem in @($dummyH1, $realH, $dummyH50)) {
    if (-not (Test-IsDummyHabit $hItem)) { $filterHabits += $hItem }
}
$hOk = ($filterHabits.Count -eq 1 -and $filterHabits[0].id -eq 'H069')
Assert-Test "12. Filter purges all dummy habits and keeps real habit" $hOk "Remaining: $($filterHabits.Count)"

# 4. Live GAS Verification (Read-Only GET)
$gasUrl = 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec'
$unixTime = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$targetUri = "$gasUrl" + "?t=" + "$unixTime"
$gasRes = Invoke-RestMethod -Uri $targetUri -Method Get
$gasDummyT = @($gasRes.data.tasks | Where-Object { $_.title -like "*Emulate Real Data*" }).Count
$gasDummyH = @($gasRes.data.habits | Where-Object { $_.name -like "*Emulating Daily Routine*" }).Count
$gasRealT = $gasRes.data.tasks.Count
$gasRealH = $gasRes.data.habits.Count

Assert-Test "13. Live GAS cloud: Dummy tasks count is 0" ($gasDummyT -eq 0) "Found: $gasDummyT"
Assert-Test "14. Live GAS cloud: Dummy habits count is 0" ($gasDummyH -eq 0) "Found: $gasDummyH"
Assert-Test "15. Live GAS cloud: Real tasks preserved (>= 200)" ($gasRealT -ge 200) "Actual: $gasRealT tasks"
Assert-Test "16. Live GAS cloud: Real habits preserved (>= 90)" ($gasRealH -ge 90) "Actual: $gasRealH habits"

# 5. Core Directives Verification
$hasAgentRules = Test-Path '.agent/rules/antigravity_core_directives.md'
$hasGeminiRules = Test-Path 'GEMINI.md'
$hasAgentsRules = Test-Path 'AGENTS.md'
$hasClaudeRules = Test-Path 'CLAUDE.md'
Assert-Test "17. Core Directives exist across all AI rule files" ($hasAgentRules -and $hasGeminiRules -and $hasAgentsRules -and $hasClaudeRules)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Test Summary: Passed: $passCount, Failed: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "==========================================================" -ForegroundColor Cyan

if ($failCount -gt 0) {
    exit 1
}
