$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless", "--remote-debugging-port=9228", "--disable-gpu" -PassThru
Start-Sleep -Seconds 2

try {
  $fileUrl = "file:///" + ((Get-Item "C:\Users\nonst\recover\obsidian folder\006_AI_Workspace\habit-app\index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9228/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait()

  $script:msgId = 0
  function Exec-Js($code) {
    $cmd = @{
      id = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
      method = "Runtime.evaluate"
      params = @{
        expression = $code
        returnByValue = $true
      }
    } | ConvertTo-Json -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $buf = New-Object byte[] 65536
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    return ($resText | ConvertFrom-Json).result.result.value
  }

  $testScript = @'
(() => {
  const tests = [];
  function assert(name, condition, extra = '') {
    tests.push({ name, pass: Boolean(condition), extra });
  }

  // 1. Check version
  assert("APP_VERSION is v1.9.0", APP_VERSION === 'v1.9.0', APP_VERSION);
  const verBadge = document.getElementById('app-version-badge');
  assert("Version badge in DOM shows v1.9.0", verBadge && verBadge.textContent === 'v1.9.0', verBadge ? verBadge.textContent : 'none');

  // Setup test data matching user environment
  const t206 = {
    id: "T206",
    title: "オンゴーイング プロジェクト タスクプランニング",
    status: "in_progress",
    startTimestamp: Date.now() - (73 * 60 * 1000),
    estMin: 15,
    actMin: 73,
    accumulatedSeconds: 73 * 60,
    section: "第1セッション",
    timingType: "section"
  };

  const h_plan = {
    id: "H_plan",
    name: "起床 〜 第1セッションプランニング",
    section: "第1セッション",
    timingType: "section",
    targetMin: 12,
    status: "uncompleted",
    history: {}
  };

  const t_wait = {
    id: "T_wait1",
    title: "待機中タスク1",
    section: "第1セッション",
    timingType: "section",
    estMin: 20,
    status: "uncompleted"
  };

  state.tasks = [t206, t_wait];
  state.habits = [h_plan];
  state.currentSection = "第1セッション";
  state.currentMode = "section";
  state.selectedDateOffset = 0;
  state.activeTaskId = "T206";
  state.activeHabitId = null;
  state.filters.status = "uncompleted";

  renderApp();

  // 2. Start waiting habit H_plan
  const habitCard = document.querySelector('.habit-card[data-id="H_plan"]');
  assert("Waiting habit card rendered in section", Boolean(habitCard));
  const habitStartBtn = habitCard ? habitCard.querySelector('.btn-habit-action.start') : null;
  assert("Habit has '▶ 開始' button", Boolean(habitStartBtn));

  if (habitStartBtn) habitStartBtn.click();

  assert("H_plan status is in_progress", h_plan.status === 'in_progress');
  assert("T206 auto-paused", t206.status === 'paused');
  assert("state.activeHabitId is H_plan", state.activeHabitId === 'H_plan');
  assert("state.activeTaskId is cleared (null)", state.activeTaskId === null);

  const activeNameEl = document.getElementById('active-habit-name');
  assert("Status bar shows running habit", activeNameEl && activeNameEl.textContent.includes('起床 〜 第1セッションプランニング'), activeNameEl ? activeNameEl.textContent : 'none');

  const habitCardStarted = document.querySelector('.habit-card[data-id="H_plan"]');
  assert("Started habit card in DOM", Boolean(habitCardStarted));
  if (habitCardStarted) {
    const computedBg = window.getComputedStyle(habitCardStarted).backgroundColor;
    assert("Habit card background is NOT pitch black (not rgba(8,20,16,0.95))", !computedBg.includes('rgba(8, 20, 16'), computedBg);
    const doneBtn = habitCardStarted.querySelector('.btn-habit-action.done');
    assert("Habit card has '✓ 完了' button", Boolean(doneBtn));
  }

  // 3. Test updateLiveTimers()
  updateLiveTimers();
  const timerTextEl = document.getElementById('habit-progress-time-H_plan');
  assert("Habit card live timer element exists and updated", Boolean(timerTextEl && timerTextEl.textContent && timerTextEl.textContent.includes('12')), timerTextEl ? timerTextEl.textContent : 'none');

  // 4. Test complete habit
  const habitDoneBtn = habitCardStarted ? habitCardStarted.querySelector('.btn-habit-action.done') : null;
  if (habitDoneBtn) habitDoneBtn.click();

  assert("H_plan status is completed", h_plan.status === 'completed');
  assert("state.activeHabitId cleared after complete", state.activeHabitId === null);

  // 5. Test start waiting task T_wait1
  const taskCard = document.querySelector('.task-card[data-id="T_wait1"]');
  assert("T_wait1 task card in DOM", Boolean(taskCard));
  const taskStartBtn = taskCard ? taskCard.querySelector('.btn-task-action.start') : null;
  assert("T_wait1 has '▶ 開始' button", Boolean(taskStartBtn));

  if (taskStartBtn) taskStartBtn.click();

  assert("T_wait1 status is in_progress", t_wait.status === 'in_progress');
  assert("state.activeTaskId is T_wait1", state.activeTaskId === 'T_wait1');
  assert("state.activeHabitId is null", state.activeHabitId === null);

  const resumeModal = document.getElementById('modal-resume-note');
  const isModalBlocking = resumeModal && resumeModal.classList.contains('active');
  assert("No blocking modal overlay on routine task start", !isModalBlocking, resumeModal ? resumeModal.className : 'none');

  const taskCardStarted = document.querySelector('.task-card[data-id="T_wait1"]');
  assert("Started task card in DOM", Boolean(taskCardStarted));
  if (taskCardStarted) {
    const computedBg = window.getComputedStyle(taskCardStarted).backgroundColor;
    assert("Task card background is NOT pitch black (not rgba(8,14,26,0.95))", !computedBg.includes('rgba(8, 14, 26'), computedBg);
    const taskDoneBtn = taskCardStarted.querySelector('.btn-task-action.done');
    assert("Task card has '✓ 完了' button", Boolean(taskDoneBtn));
  }

  // 6. Test task timer live tick
  updateLiveTimers();
  const taskTimerEl = document.getElementById('task-progress-time-T_wait1');
  assert("Task card live timer element exists and updated", Boolean(taskTimerEl && taskTimerEl.textContent && taskTimerEl.textContent.includes('20')), taskTimerEl ? taskTimerEl.textContent : 'none');

  // 7. Test task completion
  const taskDoneBtn = taskCardStarted ? taskCardStarted.querySelector('.btn-task-action.done') : null;
  if (taskDoneBtn) taskDoneBtn.click();

  assert("T_wait1 status is completed", t_wait.status === 'completed');
  assert("state.activeTaskId cleared after complete", state.activeTaskId === null);

  // 8. Test Cloud Sync zombie protection (mergeTasksDeep)
  const localTasks = [
    { id: "T206", status: "paused", accumulatedSeconds: 4380, actMin: 73 }
  ];
  const cloudTasks = [
    { id: "T206", status: "in_progress", startTimestamp: Date.now() - 75*60*1000 }
  ];
  const merged = mergeTasksDeep(localTasks, cloudTasks);
  const mergedT206 = merged.find(t => t.id === "T206");
  assert("mergeTasksDeep does NOT resurrect locally paused task to in_progress", mergedT206 && mergedT206.status === 'paused', mergedT206 ? mergedT206.status : 'none');

  return tests;
})()
'@

  $results = Exec-Js $testScript
  Write-Host "=================================================="
  Write-Host " Gendrive v1.9.0 Comprehensive Verification Results"
  Write-Host "=================================================="
  $allPass = $true
  $results | ForEach-Object {
    if ($_.pass) {
      Write-Host "PASS: $($_.name)" -ForegroundColor Green
    } else {
      Write-Host "FAIL: $($_.name) [$($_.extra)]" -ForegroundColor Red
      $allPass = $false
    }
  }
  Write-Host "=================================================="
  if ($allPass) {
    Write-Host "SUCCESS: ALL v1.9.0 VERIFICATION TESTS PASSED!" -ForegroundColor Cyan
  } else {
    Write-Host "FAILURE: SOME TESTS FAILED!" -ForegroundColor Red
    exit 1
  }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
}
