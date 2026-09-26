# test_master_subtab_and_shortcuts.ps1 - Master Subtab order and Shift+4 test

$ErrorActionPreference = "Stop"

function Assert-Condition($desc, $cond) {
    if ($cond) {
        Write-Host " [PASS] $desc" -ForegroundColor Green
    } else {
        Write-Host " [FAIL] $desc" -ForegroundColor Red
        exit 1
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Master Subtab Order and 4 / Shift+4 Shortcut Test" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$indexHtml = Get-Content -Path "index.html" -Raw -Encoding UTF8
$appJs = Get-Content -Path "app.js" -Raw -Encoding UTF8
$shortcutsJs = Get-Content -Path "js/engine/keyboardShortcuts.js" -Raw -Encoding UTF8
$tableViewJs = Get-Content -Path "js/views/tableView.js" -Raw -Encoding UTF8

# 1. index.html checks
Assert-Condition "1.1 subtab-analytics is first and active" ($indexHtml.Contains('<button class="table-subtab active" data-subtab="analytics" id="subtab-analytics"'))
Assert-Condition "1.2 subtab-habits follows analytics" ($indexHtml.IndexOf('id="subtab-analytics"') -lt $indexHtml.IndexOf('id="subtab-habits"'))
Assert-Condition "1.3 subtab-tasks follows habits" ($indexHtml.IndexOf('id="subtab-habits"') -lt $indexHtml.IndexOf('id="subtab-tasks"'))
Assert-Condition "1.4 subtab-single-tasks follows tasks" ($indexHtml.IndexOf('id="subtab-tasks"') -lt $indexHtml.IndexOf('id="subtab-single-tasks"'))
Assert-Condition "1.5 subtab-profiles follows single_tasks" ($indexHtml.IndexOf('id="subtab-single-tasks"') -lt $indexHtml.IndexOf('id="subtab-profiles"'))

# 1.6 Check annotations are removed
Assert-Condition "1.6 No (3d/7d/30d/90d) in subtab-analytics" (-not $indexHtml.Contains("継続スコアボード (3d/7d/30d/90d)"))
Assert-Condition "1.7 No (習慣マスター) in subtab-habits" (-not $indexHtml.Contains("定期ハビット一覧 (習慣マスター)"))
Assert-Condition "1.8 No (定期配信マスター) in subtab-tasks" (-not $indexHtml.Contains("定期タスク一覧 (定期配信マスター)"))
Assert-Condition "1.9 No (全履歴・予定) in subtab-single-tasks" (-not $indexHtml.Contains("単発タスク一覧 (全履歴・予定)"))
Assert-Condition "1.10 No (ドメイン・部門・PJ) in subtab-profiles" (-not $indexHtml.Contains("プロファイル設定 (ドメイン・部門・PJ)"))

# 2. app.js checks
Assert-Condition "2.1 default masterSubtab is analytics" ($appJs.Contains("masterSubtab: 'analytics'"))
Assert-Condition "2.2 setMode has isReverse parameter" ($appJs.Contains("function setMode(mode, isReverse = false)"))
Assert-Condition "2.3 setMode table sets masterSubtab to analytics on entering" ($appJs.Contains("state.masterSubtab = 'analytics';"))
Assert-Condition "2.4 setMode table cycles through subtabs array" ($appJs.Contains("const subtabs = ['analytics', 'habits', 'tasks', 'single_tasks', 'profiles'];"))
Assert-Condition "2.5 setMode handles isReverse with modulo" ($appJs.Contains("currentIndex = (currentIndex - 1 + subtabs.length) % subtabs.length;"))

# 3. keyboardShortcuts.js checks
Assert-Condition "3.1 Timer mode handles 4 and Shift+4" ($shortcutsJs.Contains("e.key === '4' || e.key === '$' || (e.code === 'Digit4' && e.shiftKey)"))
Assert-Condition "3.2 Global shortcut handles 4 and $" ($shortcutsJs.Contains("case '4':") -and $shortcutsJs.Contains("case '$':"))
Assert-Condition "3.3 Global shortcut calls setMode with reverse flag" ($shortcutsJs.Contains("setMode('table', e.shiftKey || e.key === '$')"))

# 4. tableView.js checks
Assert-Condition "4.1 curSubtab fallback is analytics" ($tableViewJs.Contains("state.masterSubtab || 'analytics';"))

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " All 19 Tests Passed Successfully!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
