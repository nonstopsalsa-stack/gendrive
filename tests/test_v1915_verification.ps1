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

# 2. Verify Zero Ad-hoc String Blacklists in Codebase (対症療法ハードコード排除検証)
$storageJs = Get-Content 'js/services/storageService.js' -Encoding UTF8 -Raw
$mobileJs = Get-Content 'mobile.js' -Encoding UTF8 -Raw

$hasStorageBlacklist = ($storageJs.Contains("B社") -or $storageJs.Contains("J PREP") -or $storageJs.Contains("Emulate Real Data"))
Assert-Test "5. storageService.js contains ZERO ad-hoc string blacklists" (-not $hasStorageBlacklist)

$hasMobileBlacklist = ($mobileJs.Contains("B社") -or $mobileJs.Contains("J PREP") -or $mobileJs.Contains("Emulate Real Data"))
Assert-Test "6. mobile.js contains ZERO ad-hoc string blacklists" (-not $hasMobileBlacklist)

$hasStorageSchemaValidation = $storageJs.Contains("function isValidTask") -and $storageJs.Contains("function isValidHabit")
Assert-Test "7. storageService.js implements clean structural schema validation" $hasStorageSchemaValidation

$hasMobileSchemaValidation = $mobileJs.Contains("function isValidMobileTask") -and $mobileJs.Contains("function isValidMobileHabit")
Assert-Test "8. mobile.js implements clean structural schema validation" $hasMobileSchemaValidation

$hasStorageInterceptor = $storageJs.Contains("Test mode active. Push to production GAS URL blocked.")
Assert-Test "9. storageService.js contains production test guard interceptor" $hasStorageInterceptor

$hasMobileInterceptor = $mobileJs.Contains("Test mode active. Push to production GAS URL blocked.")
Assert-Test "10. mobile.js contains mobile production test guard interceptor" $hasMobileInterceptor

# 4. Live GAS Verification (Read-Only GET)
$gasUrl = 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec'
$unixTime = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$targetUri = "$gasUrl" + "?t=" + "$unixTime"
$gasRes = Invoke-RestMethod -Uri $targetUri -Method Get
$gasDummyT = @($gasRes.data.tasks | Where-Object { $_.title -like "*Emulate Real Data*" }).Count
$gasDummyH = @($gasRes.data.habits | Where-Object { $_.name -like "*Emulating Daily Routine*" }).Count
$gasBCompany = 0
$gasJPrep = 0
foreach ($gt in $gasRes.data.tasks) {
    if (([string]$gt.title).IndexOf("B社") -ge 0 -or [string]$gt.id -eq "T003") { $gasBCompany++ }
    if (([string]$gt.title).IndexOf("J PREP") -ge 0) { $gasJPrep++ }
}
$gasRealT = $gasRes.data.tasks.Count
$gasRealH = $gasRes.data.habits.Count

Assert-Test "11. Live GAS cloud: Dummy tasks count is 0" ($gasDummyT -eq 0) "Found: $gasDummyT"
Assert-Test "12. Live GAS cloud: Dummy habits count is 0" ($gasDummyH -eq 0) "Found: $gasDummyH"
Assert-Test "13. Live GAS cloud: B Company sample task count is 0" ($gasBCompany -eq 0) "Found: $gasBCompany"
Assert-Test "14. Live GAS cloud: J PREP obsolete task count is 0" ($gasJPrep -eq 0) "Found: $gasJPrep"
Assert-Test "15. Live GAS cloud: Real tasks preserved (>= 150)" ($gasRealT -ge 150) "Actual: $gasRealT tasks"
Assert-Test "16. Live GAS cloud: Real habits preserved (>= 90)" ($gasRealH -ge 90) "Actual: $gasRealH habits"

# 5. Core Directives Verification (Project & Global)
$hasAgentRules = Test-Path '.agent/rules/antigravity_core_directives.md'
$hasGeminiRules = Test-Path 'GEMINI.md'
$hasAgentsRules = Test-Path 'AGENTS.md'
$hasClaudeRules = Test-Path 'CLAUDE.md'
$hasGlobalRules = Test-Path "C:\Users\nonst\.gemini\config\rules\antigravity_core_directives.md"
Assert-Test "17. Core Directives exist in all project rule files" ($hasAgentRules -and $hasGeminiRules -and $hasAgentsRules -and $hasClaudeRules)
Assert-Test "18. Core Directives exist in global machine configuration rules" $hasGlobalRules

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Test Summary: Passed: $passCount, Failed: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "==========================================================" -ForegroundColor Cyan

if ($failCount -gt 0) {
    exit 1
}
