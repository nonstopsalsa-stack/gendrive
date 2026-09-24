$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless", "--remote-debugging-port=9229", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 2

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9229/json/new?$fileUrl"
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
        awaitPromise = $true
      }
    } | ConvertTo-Json -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $buf = New-Object byte[] 262144
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.result) {
      return $json.result.result.value
    }
    return $json
  }

  Write-Host "--- Checking Real GAS Data Load & App State ---"
  $script = @'
(async () => {
  const log = [];
  window.errors = [];
  window.addEventListener('error', e => {
    window.errors.push({ msg: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, error: e.error ? e.error.stack : '' });
  });

  // Load real_gas_data.js script into page to populate state
  await new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'tests/real_gas_data.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });

  if (window.__REAL_GAS_DATA__ && window.__REAL_GAS_DATA__.data) {
    state.habits = window.__REAL_GAS_DATA__.data.habits || [];
    state.tasks = window.__REAL_GAS_DATA__.data.tasks || [];
    log.push("Loaded REAL_GAS_DATA! Habits: " + state.habits.length + ", Tasks: " + state.tasks.length);
  }

  // Set Section mode & 第1セッション as in user screenshot
  state.currentSection = "第1セッション";
  state.currentMode = "section";
  state.selectedDateOffset = 0;
  state.filters.status = "uncompleted";

  renderApp();

  log.push("App Version: " + APP_VERSION);
  log.push("State currentSection: " + state.currentSection);
  log.push("State currentMode: " + state.currentMode);

  // Find H088
  const h088 = state.habits ? state.habits.find(h => h.id === 'H088') : null;
  log.push("H088 found in state: " + Boolean(h088));
  if (h088) {
    log.push("H088 name: " + h088.name + ", section: " + h088.section + ", timing: " + h088.timingType + ", display: " + h088.displayType + ", status: " + h088.status);
  }

  // Check DOM for H088
  const cardH088 = document.querySelector('.habit-card[data-id="H088"]');
  log.push("H088 in DOM: " + Boolean(cardH088));
  let startBtn = null;
  if (cardH088) {
    startBtn = cardH088.querySelector('.btn-habit-action.start');
    log.push("H088 start button in DOM: " + Boolean(startBtn));
    log.push("H088 start button onclick: " + (startBtn ? startBtn.getAttribute('onclick') : 'none'));
  }

  // NOW CLICK IT!
  if (startBtn) {
    log.push("Simulating click on H088 start button...");
    try {
      startBtn.click();
      log.push("Click executed without throwing synchronous exception.");
    } catch(err) {
      log.push("Exception during click: " + err.message + "\n" + err.stack);
    }
  }

  // Check state after click
  log.push("After click - H088 status: " + (h088 ? h088.status : 'null'));
  log.push("After click - state.activeHabitId: " + state.activeHabitId);
  log.push("After click - state.activeTaskId: " + state.activeTaskId);

  // Check DOM after click
  const cardAfter = document.querySelector('.habit-card[data-id="H088"]');
  log.push("H088 in DOM after click: " + Boolean(cardAfter));
  if (cardAfter) {
    log.push("H088 card classes: " + cardAfter.className);
    log.push("H088 card computed bg: " + window.getComputedStyle(cardAfter).backgroundColor);
    const doneBtn = cardAfter.querySelector('.btn-habit-action.done');
    log.push("H088 done button: " + Boolean(doneBtn));
    const pausePill = cardAfter.querySelector('.tc-status-pill.in-progress');
    log.push("H088 in-progress pill: " + Boolean(pausePill));
  }

  // Check if any modal is active
  const activeModals = Array.from(document.querySelectorAll('.modal, .modal-overlay, [id^="modal-"]')).filter(m => m.classList.contains('active') || window.getComputedStyle(m).display !== 'none');
  log.push("Active modals count: " + activeModals.length);
  activeModals.forEach(m => {
    log.push("Active modal ID: " + m.id + ", class: " + m.className);
  });

  return { log, errors: window.errors };
})()
'@

  $result = Exec-Js $script
  $result.log | ForEach-Object { Write-Host $_ }
  if ($result.errors -and $result.errors.Count -gt 0) {
    Write-Host "Errors: " ($result.errors | ConvertTo-Json) -ForegroundColor Red
  } else {
    Write-Host "No JS Errors captured." -ForegroundColor Green
  }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
