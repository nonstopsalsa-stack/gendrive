$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=9244", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9244/json/new?$fileUrl"
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

  const h088 = state.habits.find(h => h.id === 'H088');
  log.push("h088 in state.habits: " + JSON.stringify(h088 ? { id: h088.id, name: h088.name, section: h088.section, displayType: h088.displayType, timingType: h088.timingType, recurrence: h088.recurrence, isDisabled: h088.isDisabled } : null));

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - state.selectedDateOffset);
  const isScheduled = h088 ? isHabitScheduledForDate(h088, targetDate) : false;
  log.push("isHabitScheduledForDate: " + isScheduled);

  const inTimeWindow = h088 ? isHabitInCurrentTimeWindow(h088) : false;
  log.push("isHabitInCurrentTimeWindow: " + inTimeWindow);

  const status = h088 ? getHabitStatusForSelectedDate(h088) : false;
  log.push("getHabitStatusForSelectedDate: " + status);

  const matchesTags = h088 ? matchesTagFilters(h088) : false;
  log.push("matchesTagFilters: " + matchesTags);

  const filtered = getFilteredHabits('section');
  log.push("getFilteredHabits('section') count: " + filtered.length);
  filtered.forEach(h => log.push(`Filtered habit: [${h.id}] ${h.name}`));

  const renderedCards = Array.from(document.querySelectorAll('.habit-card'));
  log.push("DOM .habit-card count: " + renderedCards.length);
  renderedCards.forEach(c => log.push(`DOM card data-id: ${c.getAttribute('data-id')}, title: ${c.querySelector('.habit-title')?.textContent}`));

  return log;
})()
'@

  $result = Exec-Js $testScript
  $result | ForEach-Object { Write-Host $_ }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
