$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_tomorrow_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9269
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
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

    $buf = New-Object byte[] 10485760
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    return $json.result.result.value
  }

  $testScript = @'
(async () => {
  let retries = 0;
  while ((typeof pullDataFromCloud === 'undefined' || typeof renderTableAnalyticsView === 'undefined' || typeof state === 'undefined') && retries < 50) {
    await new Promise(r => setTimeout(r, 200));
    retries++;
  }

  // 1. Pull real data from cloud
  await pullDataFromCloud(true);
  await new Promise(r => setTimeout(r, 2500));

  // 2. SIMULATE TOMORROW MORNING (2026-09-27)
  // Tomorrow morning: todayKey is 2026-09-27, no habits completed yet on 2026-09-27!
  window.getTodayKey = () => '2026-09-27';
  window.getDateKeyOffset = (offset) => {
    const d = new Date(2026, 8, 27); // Month is 0-indexed (8 = September)
    d.setDate(d.getDate() - offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Re-run migration and analytics render as of tomorrow morning
  state.habits = state.habits.map((h, i) => migrateHabit(h, i));
  state.masterSubtab = 'analytics';
  if (typeof renderTableAnalyticsView === 'function') renderTableAnalyticsView();

  const rows = document.querySelectorAll('.analytics-score-row');
  const streakList = [];
  rows.forEach(row => {
    const nameEl = row.querySelector('.ana-name-text');
    const streakEl = row.querySelector('.col-ana-streak');
    const name = nameEl ? nameEl.textContent.trim() : '';
    const streak = streakEl ? streakEl.textContent.trim() : '';
    streakList.push({ name, streak });
  });

  return streakList;
})()
'@

  $results = Exec-Js $testScript
  Write-Host "================ SIMULATED TOMORROW MORNING (2026-09-27) RESULTS ================"
  $withStreak = $results | Where-Object { $_.streak -ne '-' }
  Write-Host "Active streaks on tomorrow morning (before any habit is done): $($withStreak.Count)"
  $withStreak | Select-Object -First 25 | Format-Table -AutoSize | Out-String | Write-Host

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
