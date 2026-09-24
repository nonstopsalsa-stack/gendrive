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
    errors.push({ type: 'error', message: e.message, filename: e.filename, lineno: e.lineno, stack: e.error ? e.error.stack : '' });
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
  state.currentSection = "第1セッション";
  state.currentMode = "section";
  state.selectedDateOffset = 0;
  state.filters.status = "uncompleted";

  renderApp();

  // Inspect the exact DOM elements inside section-habit-list
  const habitListEl = document.getElementById('section-habit-list');
  log.push("habitListEl child count: " + (habitListEl ? habitListEl.children.length : 0));

  const cardH088 = habitListEl.querySelector('[data-id="H088"]');
  log.push("cardH088 found: " + Boolean(cardH088));
  if (cardH088) {
    const startBtn = cardH088.querySelector('.btn-habit-action.start');
    log.push("startBtn found: " + Boolean(startBtn));
    log.push("startBtn onclick attr: " + startBtn.getAttribute('onclick'));

    // Test clicking directly on the button element
    log.push("Triggering startHabit directly via onclick or click...");
    startBtn.click();
  }

  log.push("After click - H088 status: " + state.habits.find(h => h.id === 'H088').status);
  log.push("After click - activeHabitId: " + state.activeHabitId);

  // Re-check DOM
  const cardAfter = habitListEl.querySelector('[data-id="H088"]');
  log.push("cardAfter found: " + Boolean(cardAfter));
  if (cardAfter) {
    log.push("cardAfter class: " + cardAfter.className);
    log.push("cardAfter button HTML: " + cardAfter.querySelector('.habit-actions').innerHTML);
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
