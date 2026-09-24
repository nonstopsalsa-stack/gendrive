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
    errors.push({ type: 'window.onerror', message: e.message, filename: e.filename, lineno: e.lineno, stack: e.error ? e.error.stack : '' });
  });

  // Mock time to 2026-09-21 07:45:00
  const fakeNow = new Date('2026-09-21T07:45:00+09:00');
  const RealDate = Date;
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fakeNow.getTime());
      } else {
        super(...args);
      }
    }
    static now() {
      return fakeNow.getTime();
    }
  }
  window.Date = MockDate;

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

  // Check what habits are in DOM
  const habitCards = Array.from(document.querySelectorAll('#section-habit-list .habit-card'));
  log.push("Rendered habit cards count: " + habitCards.length);
  habitCards.forEach(c => {
    const id = c.getAttribute('data-id');
    const title = c.querySelector('.habit-title')?.textContent;
    const btn = c.querySelector('.btn-habit-action');
    log.push(`Habit [${id}]: title="${title}", btnText="${btn ? btn.textContent : 'none'}"`);
  });

  // Click on H088 start button
  const h088Card = document.querySelector('.habit-card[data-id="H088"]');
  if (h088Card) {
    const startBtn = h088Card.querySelector('.btn-habit-action.start');
    log.push("Clicking H088 start button...");
    startBtn.click();
  } else {
    log.push("H088 card NOT found in DOM!");
  }

  // Check state after click
  const h088 = state.habits.find(h => h.id === 'H088');
  log.push("After click H088: status=" + (h088 ? h088.status : 'null'));
  log.push("After click activeHabitId=" + state.activeHabitId);

  // Check DOM after click
  const habitCardsAfter = Array.from(document.querySelectorAll('#section-habit-list .habit-card'));
  log.push("After click habit cards count: " + habitCardsAfter.length);
  habitCardsAfter.forEach(c => {
    const id = c.getAttribute('data-id');
    const title = c.querySelector('.habit-title')?.textContent;
    const btn = c.querySelector('.btn-habit-action');
    const pill = c.querySelector('.tc-status-pill');
    log.push(`After Habit [${id}]: title="${title}", pill="${pill ? pill.textContent : 'none'}", btnText="${btn ? btn.textContent : 'none'}", classes="${c.className}"`);
  });

  // Check what happens when 60s timer (updateHeaderAndStatus) fires!
  log.push("Simulating 60s timer (updateHeaderAndStatus)...");
  updateHeaderAndStatus();

  log.push("After updateHeaderAndStatus: currentSection=" + state.currentSection);
  const h088AfterTimer = state.habits.find(h => h.id === 'H088');
  log.push("After updateHeaderAndStatus H088 status: " + h088AfterTimer.status);

  // Check what happens when 1s timer (updateLiveTimers) fires!
  log.push("Simulating 1s timer (updateLiveTimers)...");
  updateLiveTimers();

  const h088CardLive = document.querySelector('.habit-card[data-id="H088"]');
  log.push("After updateLiveTimers - H088 card in DOM: " + Boolean(h088CardLive));
  if (h088CardLive) {
    log.push("H088 card classes: " + h088CardLive.className);
    const timerText = document.getElementById('habit-progress-time-H088');
    log.push("H088 timer text: " + (timerText ? timerText.textContent : 'none'));
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
