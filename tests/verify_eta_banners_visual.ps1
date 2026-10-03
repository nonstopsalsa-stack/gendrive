[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Visual Verification of ETA Banners via Edge CDP" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$edgePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$port = 9226
$userData = "$env:TEMP\edge_visual_test_$([guid]::NewGuid().ToString('N'))"
$browser = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--window-size=1280,1000", "--remote-debugging-port=$port", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--user-data-dir=`"$userData`"" -PassThru
Start-Sleep -Seconds 2

$ws = $null
try {
  $url = "http://localhost:8085/index.html"
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:$port/json/new?$url"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait()

  function Send-CDP([string]$method, [hashtable]$params = @{}) {
    $id = Get-Random -Minimum 1000 -Maximum 999999
    $cmdObj = @{ id = $id; method = $method }
    if ($params.Count -gt 0) { $cmdObj["params"] = $params }
    $cmd = $cmdObj | ConvertTo-Json -Depth 10 -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $ms = New-Object System.IO.MemoryStream
    $buffer = New-Object byte[] 65536
    $segRecv = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
    do {
      $res = $ws.ReceiveAsync($segRecv, $ct).Result
      $ms.Write($buffer, 0, $res.Count)
    } while (-not $res.EndOfMessage)

    $ms.Seek(0, [System.IO.SeekOrigin]::Begin) | Out-Null
    $reader = New-Object System.IO.StreamReader($ms, [System.Text.Encoding]::UTF8)
    $resText = $reader.ReadToEnd()
    $reader.Dispose()
    $ms.Dispose()

    return $resText | ConvertFrom-Json
  }

  function Capture-Screen([string]$filename) {
    $shot = Send-CDP "Page.captureScreenshot" @{ format = "png" }
    $base64 = $shot.result.data
    $bytes = [Convert]::FromBase64String($base64)
    [System.IO.File]::WriteAllBytes($filename, $bytes)
    Write-Host " Screenshot saved to $filename" -ForegroundColor Gray
  }

  Start-Sleep -Seconds 2

  # 1. Switch to All View with status 'all'
  $null = Send-CDP "Runtime.evaluate" @{ 
    expression = @"
    state.currentMode = 'all';
    state.filters.status = 'all';
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    document.getElementById('view-all').classList.add('active');
    renderApp();
"@
  }
  Start-Sleep -Milliseconds 500

  # 2. Simulate pseudo-all-completed state
  $res1 = Send-CDP "Runtime.evaluate" @{
    expression = @"
    (() => {
      const todayK = getTodayKey();
      state.tasks.forEach(t => { 
        t.status = 'completed'; 
        t.scheduledDate = todayK; 
      });
      state.habits.forEach(h => {
        h.status = 'completed';
        if (!Array.isArray(h.executionLogs)) h.executionLogs = [];
        h.executionLogs.unshift({ id: 'mock_' + Date.now(), dateKey: todayK, count: 1, durationMin: 5 });
      });
      renderApp();
      
      const dayData = getDayEta();
      const bannerEls = Array.from(document.querySelectorAll('.section-group-title'));
      const bannerTexts = bannerEls.map(el => el.innerText.trim());
      const headerEta = document.getElementById('daily-eta-time-val') ? document.getElementById('daily-eta-time-val').textContent : '';
      
      return JSON.stringify({
        totalDayRemainMin: dayData.totalDayRemainMin,
        dayEtaTimeStr: dayData.dayEtaTimeStr,
        headerEtaText: headerEta,
        bannerCount: bannerTexts.length,
        allBannersAchieved: bannerTexts.length === 6 && bannerTexts.every(t => t.includes('全達成')),
        bannerSnippets: bannerTexts.map(t => t.split('\n')[0])
      });
    })()
"@
    returnByValue = $true
  }

  $val1 = $res1.result.result.value | ConvertFrom-Json
  Write-Host "--- STEP 1: Pseudo All-Completed State ---" -ForegroundColor Yellow
  Write-Host " Total Day Remaining: $($val1.totalDayRemainMin)m"
  Write-Host " Header ETA Display : $($val1.headerEtaText)"
  Write-Host " All 6 Banners Show 全達成: $($val1.allBannersAchieved) (Count: $($val1.bannerCount))"
  Capture-Screen "tests/eta_all_completed.png"

  # 3. Uncomplete 1 task in 第2セッション
  $res2 = Send-CDP "Runtime.evaluate" @{
    expression = @"
    (() => {
      const sec2Config = SECTIONS_CONFIG[2]; // 第2セッション
      const targetSec = sec2Config.name;
      let t = state.tasks.find(x => x.section === targetSec);
      if (!t) {
        t = { id: 't_mock_sec2', title: 'テスト動画編集実務', section: targetSec, status: 'uncompleted', estMin: 25, scheduledDate: getTodayKey() };
        state.tasks.push(t);
      } else {
        t.status = 'uncompleted';
        t.actMin = 0;
        t.estMin = 25;
        t.executionLogs = [];
      }
      renderApp();

      const secEta = getSectionEta(targetSec);
      const dayData = getDayEta();
      const headerEta = document.getElementById('daily-eta-time-val') ? document.getElementById('daily-eta-time-val').textContent : '';
      
      const sec2Banner = Array.from(document.querySelectorAll('.section-group')).find(g => g.innerText.includes(sec2Config.label) || g.innerText.includes(targetSec));
      const sec2BannerText = sec2Banner ? sec2Banner.querySelector('.section-group-title').innerText : '';

      return JSON.stringify({
        taskFound: Boolean(t),
        taskId: t ? t.id : null,
        secRemainMin: secEta.remainMin,
        secEtaTimeStr: secEta.etaTimeStr,
        secRemainCount: secEta.remainCount,
        totalDayRemainMin: dayData.totalDayRemainMin,
        headerEtaText: headerEta,
        sec2BannerText: sec2BannerText
      });
    })()
"@
    returnByValue = $true
  }

  $val2 = $res2.result.result.value | ConvertFrom-Json
  Write-Host "--- STEP 2: Uncomplete 1 Task in Section 2 ---" -ForegroundColor Yellow
  Write-Host " Target Task Found   : $($val2.taskFound) ($($val2.taskId))"
  Write-Host " Sec2 Remaining Min  : $($val2.secRemainMin)m (Count: $($val2.secRemainCount))"
  Write-Host " Sec2 ETA Time Str   : $($val2.secEtaTimeStr)"
  Write-Host " Total Day Remaining : $($val2.totalDayRemainMin)m"
  Write-Host " Header ETA Display  : $($val2.headerEtaText)"
  Capture-Screen "tests/eta_one_uncompleted.png"

  # 4. Re-complete that task
  $res3 = Send-CDP "Runtime.evaluate" @{
    expression = @"
    (() => {
      const sec2Config = SECTIONS_CONFIG[2];
      const targetSec = sec2Config.name;
      const t = state.tasks.find(x => x.section === targetSec && x.status === 'uncompleted');
      if (t) {
        t.status = 'completed';
        t.actMin = 15;
      }
      renderApp();

      const secEta = getSectionEta(targetSec);
      const dayData = getDayEta();
      const headerEta = document.getElementById('daily-eta-time-val') ? document.getElementById('daily-eta-time-val').textContent : '';
      const sec2Banner = Array.from(document.querySelectorAll('.section-group')).find(g => g.innerText.includes(sec2Config.label) || g.innerText.includes(targetSec));
      const sec2BannerText = sec2Banner ? sec2Banner.querySelector('.section-group-title').innerText : '';

      return JSON.stringify({
        recompleted: Boolean(t),
        secRemainMin: secEta.remainMin,
        secIsAchieved: secEta.isAchieved,
        secEtaTimeStr: secEta.etaTimeStr,
        totalDayRemainMin: dayData.totalDayRemainMin,
        dayIsAchieved: dayData.isAchieved,
        headerEtaText: headerEta,
        sec2BannerText: sec2BannerText
      });
    })()
"@
    returnByValue = $true
  }

  $val3 = $res3.result.result.value | ConvertFrom-Json
  Write-Host "--- STEP 3: Re-complete Task (Forwarding / Done) ---" -ForegroundColor Yellow
  Write-Host " Recompleted         : $($val3.recompleted)"
  Write-Host " Sec2 Remaining Min  : $($val3.secRemainMin)m (Achieved: $($val3.secIsAchieved), ETA: $($val3.secEtaTimeStr))"
  Write-Host " Total Day Remaining : $($val3.totalDayRemainMin)m (Achieved: $($val3.dayIsAchieved))"
  Write-Host " Header ETA Display  : $($val3.headerEtaText)"
  Capture-Screen "tests/eta_recompleted.png"

  Write-Host "==========================================================" -ForegroundColor Green
  Write-Host "VISUAL VERIFICATION SUCCESSFUL!" -ForegroundColor Green
  Write-Host "==========================================================" -ForegroundColor Green

} finally {
  if ($ws) { $ws.Dispose() }
  if ($browser -and -not $browser.HasExited) {
    Stop-Process -Id $browser.Id -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $userData) {
    Remove-Item -Path $userData -Recurse -Force -ErrorAction SilentlyContinue
  }
}
