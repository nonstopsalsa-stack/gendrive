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

    $buf = New-Object byte[] 524288
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.result) {
      return $json.result.result.value
    }
    return $json
  }

  $script = @'
(async () => {
  const log = [];
  const errors = [];

  window.addEventListener('error', e => {
    errors.push({ type: 'error', message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, stack: e.error ? e.error.stack : '' });
  });
  window.addEventListener('unhandledrejection', e => {
    errors.push({ type: 'unhandledrejection', reason: String(e.reason) });
  });

  // Load real_gas_data.js
  await new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'tests/real_gas_data.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });

  state.habits = window.__REAL_GAS_DATA__.data.habits || [];
  state.tasks = window.__REAL_GAS_DATA__.data.tasks || [];
  state.currentSection = SECTIONS_CONFIG[0].name; // "第1セッション"
  state.currentMode = "section";
  state.selectedDateOffset = 0;
  state.filters.status = "uncompleted";

  renderApp();

  const cardBefore = document.querySelector('[data-id="H088"]');
  const startBtn = cardBefore ? cardBefore.querySelector('.btn-habit-action.start') : null;
  log.push("Before click: cardExists=" + Boolean(cardBefore) + ", startBtnExists=" + Boolean(startBtn));

  // Hook console.error and console.warn
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args) => {
    errors.push({ type: 'console.error', text: args.map(String).join(' ') });
    origError.apply(console, args);
  };
  console.warn = (...args) => {
    errors.push({ type: 'console.warn', text: args.map(String).join(' ') });
    origWarn.apply(console, args);
  };

  log.push("Invoking startBtn.click()...");
  try {
    startBtn.click();
    log.push("startBtn.click() synchronously finished.");
  } catch (err) {
    log.push("startBtn.click() caught exception: " + err.message + "\n" + err.stack);
  }

  // Check state immediately
  const h088 = state.habits.find(h => h.id === 'H088');
  log.push("Immediate state - H088 status: " + (h088 ? h088.status : 'null'));
  log.push("Immediate state - activeHabitId: " + state.activeHabitId);
  log.push("Immediate state - activeTaskId: " + state.activeTaskId);

  // Check DOM immediately
  const cardAfter = document.querySelector('[data-id="H088"]');
  log.push("Immediate DOM - cardExists: " + Boolean(cardAfter));
  if (cardAfter) {
    log.push("Immediate DOM - card classes: " + cardAfter.className);
    log.push("Immediate DOM - card style: " + cardAfter.getAttribute('style'));
    log.push("Immediate DOM - card computed background: " + window.getComputedStyle(cardAfter).backgroundColor);
    log.push("Immediate DOM - card computed color: " + window.getComputedStyle(cardAfter).color);
    
    const doneBtn = cardAfter.querySelector('.btn-habit-action.done');
    log.push("Immediate DOM - doneBtn: " + Boolean(doneBtn));
    const resumeBtn = cardAfter.querySelector('.btn-habit-action.resume');
    log.push("Immediate DOM - resumeBtn: " + Boolean(resumeBtn));
    const startBtnAfter = cardAfter.querySelector('.btn-habit-action.start');
    log.push("Immediate DOM - startBtn: " + Boolean(startBtnAfter));
    const inProgPill = cardAfter.querySelector('.tc-status-pill.in-progress');
    log.push("Immediate DOM - inProgPill: " + Boolean(inProgPill));
  }

  // Check active modals or overlays
  const allModals = Array.from(document.querySelectorAll('.modal, .modal-overlay, [id^="modal-"]'));
  const visibleModals = allModals.filter(m => {
    const cs = window.getComputedStyle(m);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' && (m.classList.contains('active') || cs.zIndex > 0);
  });
  log.push("Visible modals count: " + visibleModals.length);
  visibleModals.forEach(m => {
    log.push("Visible modal ID: " + m.id + ", class: " + m.className + ", z-index: " + window.getComputedStyle(m).zIndex);
  });

  // Now wait 1 second (to see if interval/timer changes anything)
  await new Promise(r => setTimeout(r, 1000));

  const card1s = document.querySelector('[data-id="H088"]');
  log.push("After 1s - cardExists: " + Boolean(card1s));
  if (card1s) {
    log.push("After 1s - card classes: " + card1s.className);
    const inProgPill1s = card1s.querySelector('.tc-status-pill.in-progress');
    log.push("After 1s - inProgPill: " + Boolean(inProgPill1s));
  }

  return { log, errors };
})()
'@

  $result = Exec-Js $script
  Write-Host "=== LOGS ==="
  $result.log | ForEach-Object { Write-Host $_ }
  Write-Host "=== ERRORS ==="
  if ($result.errors -and $result.errors.Count -gt 0) {
    Write-Host ($result.errors | ConvertTo-Json -Depth 5) -ForegroundColor Red
  } else {
    Write-Host "No Errors" -ForegroundColor Green
  }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
