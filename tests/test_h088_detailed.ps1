$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=9251", "--user-data-dir=`"$tempDir`"", "--window-size=2560,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9251/json/new?$fileUrl"
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

  // Populate localStorage exactly as real user
  localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(window.__REAL_GAS_DATA__.data.habits));
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(window.__REAL_GAS_DATA__.data.tasks));
  localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(window.__REAL_GAS_DATA__.data.metadata));

  state.habits = loadHabits();
  state.tasks = loadTasks();

  // Test 1: User is at 07:45 viewing "第1セッション"
  state.currentSection = SECTIONS_CONFIG[0].name; // "第1セッション"
  state.currentMode = "section";
  state.selectedDateOffset = 0;
  state.filters.status = "uncompleted";

  renderApp();

  const h088Card = document.querySelector('.habit-card[data-id="H088"]');
  log.push("h088Card found: " + Boolean(h088Card));
  if (h088Card) {
    log.push("h088Card classes: " + h088Card.className);
    const startBtn = h088Card.querySelector('.btn-habit-action.start');
    log.push("startBtn found: " + Boolean(startBtn));
    if (startBtn) {
      const rect = startBtn.getBoundingClientRect();
      log.push(`startBtn rect: x=${rect.left}, y=${rect.top}, w=${rect.width}, h=${rect.height}`);
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      log.push(`elementFromPoint: <${hit?.tagName}> class="${hit?.className}" id="${hit?.id}" hitIsBtn=${hit === startBtn}`);
    }
  }

  // Now, what if the user clicks on the card itself (e.g. slight miss-click, or click on startBtn)?
  // What happens when startHabit('H088') is called, then 15s heartbeat triggers pullDataFromCloud?
  log.push("\n--- Testing startHabit('H088') followed by pullDataFromCloud ---");
  startHabit('H088');

  let h088 = state.habits.find(h => h.id === 'H088');
  log.push("After startHabit: status=" + (h088 ? h088.status : 'null'));
  log.push("activeHabitId=" + state.activeHabitId);
  log.push("activeTaskId=" + state.activeTaskId);

  // Check DOM
  let cardAfter = document.querySelector('.habit-card[data-id="H088"]');
  log.push("cardAfter in DOM: " + Boolean(cardAfter));
  if (cardAfter) {
    log.push("cardAfter classes: " + cardAfter.className);
    const pill = cardAfter.querySelector('.tc-status-pill');
    log.push("pill text: " + (pill ? pill.textContent : 'none'));
    const btn = cardAfter.querySelector('.btn-habit-action');
    log.push("btn text: " + (btn ? btn.textContent : 'none'));
  }

  // Now simulate cloud pull with the original temp_gas.json data where H088 was uncompleted
  log.push("\n--- Simulating 15s pullDataFromCloud while H088 is in_progress ---");
  const cloudData = window.__REAL_GAS_DATA__.data;
  // In cloud, H088 is uncompleted
  const cloudH088 = cloudData.habits.find(h => h.id === 'H088');
  log.push("cloud H088 status: " + (cloudH088 ? cloudH088.status : 'null'));

  // Run mergeHabitsDeep
  const mergedHabits = mergeHabitsDeep(state.habits, cloudData.habits);
  const mergedH088 = mergedHabits.find(h => h.id === 'H088');
  log.push("merged H088 status: " + (mergedH088 ? mergedH088.status : 'null'));

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
