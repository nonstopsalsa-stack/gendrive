# Gendrive v1.9.23 verification test suite:
# 1. Task default estMin = 30 (DEFAULT_TASK_DEFAULTS, index.html, modal, calculation fallbacks)
# 2. Calendar view month/year follow during date navigation (prevDay, nextDay, header buttons, ArrowLeft/ArrowRight)
$ErrorActionPreference = 'Continue'
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " [TEST SUITE] Gendrive v1.9.23 Feature Verification" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$tempDir = Join-Path $env:TEMP "edge_profile_v1923_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$port = 9523
Write-Host "[1/4] Starting headless Edge on port $port ..." -ForegroundColor Yellow
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

$passed = 0; $failed = 0
function Report($name, $pass, $detail = "") {
  if ($pass) { Write-Host "  [PASS] $name" -ForegroundColor Green; $script:passed++ }
  else { Write-Host "  [FAIL] $name - $detail" -ForegroundColor Red; $script:failed++ }
}

try {
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?about:blank"
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object System.Uri($page.webSocketDebuggerUrl)), $ct).Wait(8000) | Out-Null
  Write-Host "[2/4] Connected to CDP." -ForegroundColor Green
  $script:msgId = 0

  function Send-Cdp($method, $params) {
    $id = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
    $cmd = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Compress -Depth 8
    $bytes = [Text.Encoding]::UTF8.GetBytes($cmd)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait(10000) | Out-Null
    $deadline = (Get-Date).AddSeconds(40)
    while ((Get-Date) -lt $deadline) {
      $ms = New-Object System.IO.MemoryStream
      $buf = New-Object byte[] 65536
      do {
        $rs = New-Object System.ArraySegment[byte] -ArgumentList @(, $buf)
        $task = $ws.ReceiveAsync($rs, $ct)
        if (-not $task.Wait(40000)) { throw "CDP receive timeout" }
        $ms.Write($buf, 0, $task.Result.Count)
      } while (-not $task.Result.EndOfMessage)
      $json = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
      if ($json.id -eq $id) { return $json }
    }
    throw "CDP response timeout for $method"
  }

  Send-Cdp 'Page.enable' @{} | Out-Null
  Send-Cdp 'Page.addScriptToEvaluateOnNewDocument' @{ source = "window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));window.addEventListener('unhandledrejection',e=>window.__errs.push('UNHANDLED:'+String(e.reason)));" } | Out-Null
  $fileUrl = "file:///" + ((Get-Item (Join-Path $PSScriptRoot '..\index.html')).FullName.Replace('\', '/').Replace(' ', '%20'))
  Write-Host "[3/4] Navigating: $fileUrl" -ForegroundColor Yellow
  Send-Cdp 'Page.navigate' @{ url = $fileUrl } | Out-Null
  Start-Sleep -Seconds 5

  # Check JS errors on page load
  $errRes = Send-Cdp 'Runtime.evaluate' @{ expression = "JSON.stringify(window.__errs || [])"; returnByValue = $true }
  $errs = ConvertFrom-Json $errRes.result.result.value
  Report "Initial page load zero JS errors" ($errs.Length -eq 0) ($errs -join "; ")

  Write-Host "[4/4] Executing feature tests..." -ForegroundColor Yellow

  # Test 1: DEFAULT_TASK_DEFAULTS.estMin === 30
  $res1 = Send-Cdp 'Runtime.evaluate' @{
    expression = "DEFAULT_TASK_DEFAULTS.estMin === 30"
    returnByValue = $true
  }
  Report "DEFAULT_TASK_DEFAULTS.estMin is 30" ($res1.result.result.value -eq $true) "Got: $($res1.result.result.value)"

  # Test 2: index.html #add-task-est-min initial value is 30
  $res2 = Send-Cdp 'Runtime.evaluate' @{
    expression = "document.getElementById('add-task-est-min').getAttribute('value') === '30' && Number(document.getElementById('add-task-est-min').value) === 30"
    returnByValue = $true
  }
  Report "index.html #add-task-est-min initial attribute and property is 30" ($res2.result.result.value -eq $true) "Got: $($res2.result.result.value)"

  # Test 3: openAddTaskModal() sets #add-task-est-min to 30
  $res3 = Send-Cdp 'Runtime.evaluate' @{
    expression = "(() => { openAddTaskModal(); const val = Number(document.getElementById('add-task-est-min').value); closeModal(); return val === 30; })()"
    returnByValue = $true
  }
  Report "openAddTaskModal() sets #add-task-est-min to 30" ($res3.result.result.value -eq $true) "Got: $($res3.result.result.value)"

  # Test 4: calculateMovingAverageDuration fallback
  $res4 = Send-Cdp 'Runtime.evaluate' @{
    expression = "(() => { const dummyNewTask = { id: 'T999', title: 'New Test Task' }; const taskFallback = calculateMovingAverageDuration(dummyNewTask, 'task'); const dummyHabit = { id: 'H999', name: 'New Test Habit' }; const habitFallback = calculateMovingAverageDuration(dummyHabit, 'habit'); const taskWithLog = { id: 'T998', title: 'With Log', executionLogs: [{ durationMin: 45, dateKey: '2026-10-01' }] }; const taskWithAvg = calculateMovingAverageDuration(taskWithLog, 'task'); return { taskFallback, habitFallback, taskWithAvg, pass: taskFallback === 30 && habitFallback === 5 && taskWithAvg === 45 }; })()"
    returnByValue = $true
  }
  $r4Data = $res4.result.result.value
  Report "calculateMovingAverageDuration fallback (Task:30, Habit:5, Log:45)" ($r4Data.pass -eq $true) "Task=$($r4Data.taskFallback), Habit=$($r4Data.habitFallback), Avg=$($r4Data.taskWithAvg)"

  # Test 5: getEstimatedDuration fallback
  $res5 = Send-Cdp 'Runtime.evaluate' @{
    expression = "(() => { const dummyNewTask = { id: 'T999', title: 'New Test Task' }; const taskEst = getEstimatedDuration(dummyNewTask, 'task'); const dummyHabit = { id: 'H999', name: 'New Test Habit' }; const habitEst = getEstimatedDuration(dummyHabit, 'habit'); return { taskEstMin: taskEst.targetMin, habitEstMin: habitEst.targetMin, pass: taskEst.targetMin === 30 && habitEst.targetMin === 5 }; })()"
    returnByValue = $true
  }
  $r5Data = $res5.result.result.value
  Report "getEstimatedDuration fallback (Task:30, Habit:5)" ($r5Data.pass -eq $true) "Task=$($r5Data.taskEstMin), Habit=$($r5Data.habitEstMin)"

  # Test 6: prevDay() and nextDay() calendar month follow
  $res6 = Send-Cdp 'Runtime.evaluate' @{
    expression = "(() => { resetToToday(); prevDay(); const d1 = new Date(); d1.setDate(d1.getDate() - 1); const match1 = (state.selectedDateOffset === 1 && state.calendarViewYear === d1.getFullYear() && state.calendarViewMonth === d1.getMonth()); nextDay(); const d0 = new Date(); const match0 = (state.selectedDateOffset === 0 && state.calendarViewYear === d0.getFullYear() && state.calendarViewMonth === d0.getMonth()); return { match1, match0, pass: match1 && match0 }; })()"
    returnByValue = $true
  }
  $r6Data = $res6.result.result.value
  Report "prevDay() & nextDay() update calendarViewYear and calendarViewMonth" ($r6Data.pass -eq $true) "match1=$($r6Data.match1), match0=$($r6Data.match0)"

  # Test 7: Month boundary crossing follow & is-selected calendar cell
  $res7 = Send-Cdp 'Runtime.evaluate' @{
    expression = "(() => { resetToToday(); const now = new Date(); const currentDayOfMonth = now.getDate(); const offsetToPrevMonthEnd = currentDayOfMonth; state.selectedDateOffset = currentDayOfMonth - 1; syncCalendarViewToSelectedDate(); renderApp(); const monthBeforeCross = state.calendarViewMonth; prevDay(); const expectedPrevDate = new Date(); expectedPrevDate.setDate(expectedPrevDate.getDate() - offsetToPrevMonthEnd); const expectedMonth = expectedPrevDate.getMonth(); const expectedYear = expectedPrevDate.getFullYear(); const monthAfterCross = state.calendarViewMonth; const yearAfterCross = state.calendarViewYear; const selCellAfter = document.querySelector('.cal-day-cell.is-selected'); const hasSelAfter = Boolean(selCellAfter && !selCellAfter.classList.contains('other-month')); nextDay(); const monthAfterReturn = state.calendarViewMonth; const yearAfterReturn = state.calendarViewYear; const selCellReturn = document.querySelector('.cal-day-cell.is-selected'); const hasSelReturn = Boolean(selCellReturn && !selCellReturn.classList.contains('other-month')); resetToToday(); return { monthBeforeCross, expectedMonth, monthAfterCross, yearAfterCross, hasSelAfter, monthAfterReturn, hasSelReturn, pass: (monthAfterCross === expectedMonth && yearAfterCross === expectedYear && hasSelAfter && monthAfterReturn === monthBeforeCross && hasSelReturn) }; })()"
    returnByValue = $true
  }
  $r7Data = $res7.result.result.value
  Report "Month boundary crossing (prevDay/nextDay) switches calendar month & keeps is-selected cell" ($r7Data.pass -eq $true) "expectedMonth=$($r7Data.expectedMonth), monthAfterCross=$($r7Data.monthAfterCross), hasSelAfter=$($r7Data.hasSelAfter), hasSelReturn=$($r7Data.hasSelReturn)"

  # Test 8: Header date buttons (btn-date-prev / btn-date-next) use prevDay/nextDay
  $res8 = Send-Cdp 'Runtime.evaluate' @{
    expression = "(() => { resetToToday(); const btnPrev = document.getElementById('btn-date-prev'); const btnNext = document.getElementById('btn-date-next'); if (!btnPrev || !btnNext) return { pass: false, error: 'buttons not found' }; btnPrev.click(); const offsetAfterPrev = state.selectedDateOffset; const d1 = new Date(); d1.setDate(d1.getDate() - 1); const monthAfterPrev = state.calendarViewMonth; const expectedMonth1 = d1.getMonth(); btnNext.click(); const offsetAfterNext = state.selectedDateOffset; const monthAfterNext = state.calendarViewMonth; const expectedMonth0 = (new Date()).getMonth(); resetToToday(); return { offsetAfterPrev, offsetAfterNext, pass: (offsetAfterPrev === 1 && monthAfterPrev === expectedMonth1 && offsetAfterNext === 0 && monthAfterNext === expectedMonth0) }; })()"
    returnByValue = $true
  }
  $r8Data = $res8.result.result.value
  Report "Header date buttons click triggers prevDay/nextDay and follows calendar month" ($r8Data.pass -eq $true) "offsetPrev=$($r8Data.offsetAfterPrev), offsetNext=$($r8Data.offsetAfterNext)"

  # Test 9: ArrowLeft / ArrowRight keyboard shortcuts trigger prevDay/nextDay
  $res9 = Send-Cdp 'Runtime.evaluate' @{
    expression = "(() => { resetToToday(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); const offsetAfterArrowLeft = state.selectedDateOffset; const d1 = new Date(); d1.setDate(d1.getDate() - 1); const monthAfterArrowLeft = state.calendarViewMonth; const expectedMonth1 = d1.getMonth(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); const offsetAfterArrowRight = state.selectedDateOffset; const monthAfterArrowRight = state.calendarViewMonth; const expectedMonth0 = (new Date()).getMonth(); resetToToday(); return { offsetAfterArrowLeft, offsetAfterArrowRight, pass: (offsetAfterArrowLeft === 1 && monthAfterArrowLeft === expectedMonth1 && offsetAfterArrowRight === 0 && monthAfterArrowRight === expectedMonth0) }; })()"
    returnByValue = $true
  }
  $r9Data = $res9.result.result.value
  Report "Keyboard ArrowLeft/ArrowRight shortcuts navigate date and update calendar view" ($r9Data.pass -eq $true) "left=$($r9Data.offsetAfterArrowLeft), right=$($r9Data.offsetAfterArrowRight)"

  # Check final errors
  $finalErrRes = Send-Cdp 'Runtime.evaluate' @{ expression = "JSON.stringify(window.__errs || [])"; returnByValue = $true }
  $finalErrs = ConvertFrom-Json $finalErrRes.result.result.value
  Report "Final state zero JS runtime errors" ($finalErrs.Length -eq 0) ($finalErrs -join "; ")

} finally {
  if ($ws) { $ws.Dispose() }
  if ($edge) { Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
  if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " RESULTS: Passed=$passed, Failed=$failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "====================================================" -ForegroundColor Cyan

if ($failed -gt 0) { exit 1 } else { exit 0 }
