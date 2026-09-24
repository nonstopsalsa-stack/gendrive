$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=9245", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9245/json/new?$fileUrl"
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

    $buf = New-Object byte[] 1048576
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.result) {
      return $json.result.result.value
    }
    return $json
  }

  $testScript = @'
(async () => {
  const log = [];
  const errors = [];

  window.addEventListener('error', e => {
    errors.push({ type: 'window.onerror', message: e.message, filename: e.filename, lineno: e.lineno, stack: e.error ? e.error.stack : '' });
  });

  // Load real_gas_data.js
  await new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'tests/real_gas_data.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });

  // Populate localStorage with correct storage keys
  localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(window.__REAL_GAS_DATA__.data.habits));
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(window.__REAL_GAS_DATA__.data.tasks));

  state.habits = loadHabits();
  state.tasks = loadTasks();
  state.currentSection = "第1セッション";
  state.currentMode = "section";
  state.selectedDateOffset = 0;
  state.filters.status = "uncompleted";

  renderApp();

  const cardH088 = document.querySelector('.habit-card[data-id="H088"]');
  log.push("cardH088 found: " + Boolean(cardH088));
  if (!cardH088) {
    log.push("state.currentSection: " + state.currentSection);
    const rendered = Array.from(document.querySelectorAll('.habit-card')).map(c => c.getAttribute('data-id'));
    log.push("Rendered habit ids: " + rendered.join(', '));
    return { log, errors };
  }

  const startBtn = cardH088.querySelector('.btn-habit-action.start');
  log.push("startBtn found: " + Boolean(startBtn));

  log.push("Clicking startBtn...");
  startBtn.click();

  const h088 = state.habits.find(h => h.id === 'H088');
  log.push("After click H088 status: " + h088.status);
  log.push("After click activeHabitId: " + state.activeHabitId);
  log.push("After click activeTaskId: " + state.activeTaskId);

  // Check DOM after click
  const cardAfter = document.querySelector('.habit-card[data-id="H088"]');
  log.push("cardAfter found: " + Boolean(cardAfter));
  if (cardAfter) {
    log.push("cardAfter classes: " + cardAfter.className);
    const pill = cardAfter.querySelector('.tc-status-pill');
    log.push("cardAfter status pill: " + (pill ? pill.textContent : 'none') + ", class=" + (pill ? pill.className : ''));
    const btn = cardAfter.querySelector('.btn-habit-action');
    log.push("cardAfter button: " + (btn ? btn.textContent : 'none') + ", class=" + (btn ? btn.className : ''));
  }

  return { log, errors };
})()
'@

  $result = Exec-Js $testScript
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
