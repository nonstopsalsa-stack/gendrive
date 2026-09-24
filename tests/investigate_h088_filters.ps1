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

  // Load real_gas_data.js
  await new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'tests/real_gas_data.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });

  state.habits = window.__REAL_GAS_DATA__.data.habits || [];
  state.tasks = window.__REAL_GAS_DATA__.data.tasks || [];

  // Set Section from SECTIONS_CONFIG[0].name directly (avoids any powershell encoding issue)
  state.currentSection = SECTIONS_CONFIG[0].name; // "第1セッション"
  state.currentMode = "section";
  state.selectedDateOffset = 0;
  state.filters.status = "uncompleted";

  const h088 = state.habits.find(h => h.id === 'H088');
  log.push("h088: " + JSON.stringify(h088));

  const targetDate = new Date();
  const isSched = isHabitScheduledForDate(h088, targetDate);
  log.push("isHabitScheduledForDate: " + isSched);

  const inTimeWindow = isHabitInCurrentTimeWindow(h088);
  log.push("isHabitInCurrentTimeWindow: " + inTimeWindow);

  const tagMatch = matchesTagFilters(h088);
  log.push("matchesTagFilters: " + tagMatch);

  const habitStatus = getHabitStatusForSelectedDate(h088);
  log.push("getHabitStatusForSelectedDate: " + habitStatus);

  const filteredHabits = getFilteredHabits('section');
  log.push("filteredHabits count in section: " + filteredHabits.length);
  const inFiltered = filteredHabits.some(h => h.id === 'H088');
  log.push("H088 in filteredHabits: " + inFiltered);

  renderApp();

  const card = document.querySelector('[data-id="H088"]');
  log.push("H088 in DOM after renderApp: " + Boolean(card));
  if (card) {
    log.push("Card outerHTML: " + card.outerHTML);
  } else {
    // Check what is in section-habit-list
    const habitListEl = document.getElementById('section-habit-list');
    log.push("section-habit-list innerHTML: " + (habitListEl ? habitListEl.innerHTML : 'none'));
  }

  return log;
})()
'@

  $result = Exec-Js $script
  $result | ForEach-Object { Write-Host $_ }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
