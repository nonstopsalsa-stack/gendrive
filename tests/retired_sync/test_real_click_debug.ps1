$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=9246", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9246/json/new?$fileUrl"
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

  // Intercept console.error and console.warn
  const origErr = console.error;
  console.error = function(...args) {
    errors.push({ type: 'console.error', text: args.map(a => String(a?.stack || a)).join(' ') });
    origErr.apply(console, args);
  };
  const origWarn = console.warn;
  console.warn = function(...args) {
    errors.push({ type: 'console.warn', text: args.map(String).join(' ') });
    origWarn.apply(console, args);
  };

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

  // Reload state from localStorage
  state.habits = loadHabits();
  state.tasks = loadTasks();

  // Switch to Section 1 using the config name directly (avoiding encoding issues)
  state.currentSection = SECTIONS_CONFIG[0].name; // "第1セッション"
  state.currentMode = "section";
  state.selectedDateOffset = 0;
  state.filters.status = "uncompleted";

  renderApp();

  log.push("state.habits loaded: " + state.habits.length);
  log.push("state.tasks loaded: " + state.tasks.length);
  log.push("state.currentSection: " + state.currentSection);

  const h088Card = document.querySelector('.habit-card[data-id="H088"]');
  log.push("H088 card in DOM: " + Boolean(h088Card));

  if (!h088Card) {
    const allCards = Array.from(document.querySelectorAll('.habit-card')).map(c => c.getAttribute('data-id'));
    log.push("All cards in DOM: " + allCards.join(', '));
    return { log, errors };
  }

  const startBtn = h088Card.querySelector('.btn-habit-action.start');
  log.push("startBtn in H088: " + Boolean(startBtn));

  // Check click hit testing
  const rect = startBtn.getBoundingClientRect();
  log.push(`startBtn rect: left=${rect.left}, top=${rect.top}, width=${rect.width}, height=${rect.height}`);
  const hitEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  log.push(`hitEl: <${hitEl?.tagName}> class="${hitEl?.className}" id="${hitEl?.id}"`);
  log.push(`hitEl === startBtn: ${hitEl === startBtn}`);

  log.push("Executing startHabit('H088')...");
  try {
    startHabit('H088');
    log.push("startHabit('H088') completed without exception.");
  } catch (err) {
    log.push("startHabit EXCEPTION: " + err.message + "\n" + err.stack);
  }

  // Check state after startHabit
  const h088 = state.habits.find(h => h.id === 'H088');
  log.push("After start: H088 status = " + (h088 ? h088.status : 'null'));
  log.push("After start: activeHabitId = " + state.activeHabitId);
  log.push("After start: activeTaskId = " + state.activeTaskId);

  // Check DOM after startHabit
  const cardAfter = document.querySelector('.habit-card[data-id="H088"]');
  log.push("cardAfter in DOM: " + Boolean(cardAfter));
  if (cardAfter) {
    log.push("cardAfter classes: " + cardAfter.className);
    log.push("cardAfter computed background: " + window.getComputedStyle(cardAfter).background);
    log.push("cardAfter computed color: " + window.getComputedStyle(cardAfter).color);
    const inProgPill = cardAfter.querySelector('.tc-status-pill.in-progress');
    log.push("cardAfter inProgPill: " + Boolean(inProgPill));
    const doneBtn = cardAfter.querySelector('.btn-habit-action.done');
    log.push("cardAfter doneBtn: " + Boolean(doneBtn));
    const startBtnAfter = cardAfter.querySelector('.btn-habit-action.start');
    log.push("cardAfter startBtn: " + Boolean(startBtnAfter));
  }

  // Check T206 task status
  const t206 = state.tasks.find(t => t.id === 'T206');
  log.push("T206 status: " + (t206 ? t206.status : 'null'));

  // What about silent cloud pull?
  log.push("Calling pullDataFromCloud(false, true)...");
  try {
    await pullDataFromCloud(false, true);
    log.push("pullDataFromCloud completed.");
  } catch (err) {
    log.push("pullDataFromCloud caught error: " + err.message);
  }

  const h088AfterCloud = state.habits.find(h => h.id === 'H088');
  log.push("After cloud sync: H088 status = " + (h088AfterCloud ? h088AfterCloud.status : 'null'));

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
