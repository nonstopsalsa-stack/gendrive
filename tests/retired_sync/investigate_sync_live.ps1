$ErrorActionPreference = 'Continue'
Write-Host "=== Gendrive Sync Investigation Runner ===" -ForegroundColor Cyan

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_investigate_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9388
Write-Host "1. Launching Edge in headless mode on port $port..." -ForegroundColor Yellow
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "C:\Users\nonst\recover\obsidian folder\006_AI_Workspace\habit-app\index.html").FullName.Replace('\', '/'))
  Write-Host "2. Connecting to Gendrive index: $fileUrl" -ForegroundColor Yellow
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait(5000) | Out-Null
  Write-Host "3. Connected to Chrome DevTools Protocol." -ForegroundColor Green

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
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait(10000) | Out-Null

    $buf = New-Object byte[] 2097152
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.exceptionDetails) {
      Write-Host "JS EXCEPTION: $($json.result.exceptionDetails.exception.description)" -ForegroundColor Red
    }
    return $json.result.result.value
  }

  Write-Host "4. Checking current sync status and GAS URL in browser environment..." -ForegroundColor Yellow
  $statusCheck = Exec-Js @'
  (() => {
    return {
      version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown',
      gasUrl: typeof getGasApiUrl === 'function' ? getGasApiUrl() : 'none',
      tasksCount: state?.tasks?.length || 0,
      habitsCount: state?.habits?.length || 0,
      syncMetadata: typeof getSyncMetadata === 'function' ? getSyncMetadata() : null,
      syncStatusText: document.getElementById('sync-status')?.textContent || 'none'
    };
  })()
'@
  Write-Host "Browser state:" -ForegroundColor Cyan
  $statusCheck | Format-List | Out-String | Write-Host

  Write-Host "5. Executing live pushDataToCloud() and measuring exact duration and error..." -ForegroundColor Yellow
  $pushResult = Exec-Js @'
  (async () => {
    const startTime = Date.now();
    let result = { start: startTime, error: null, success: false, statusText: '', duration: 0 };
    try {
      await pushDataToCloud();
      result.duration = Date.now() - startTime;
      result.statusText = document.getElementById('sync-status')?.textContent || '';
      result.success = result.statusText.includes('クラウド同期済') || result.statusText.includes('保存完了');
    } catch (e) {
      result.error = e.toString();
      result.duration = Date.now() - startTime;
    }
    return result;
  })()
'@
  Write-Host "Push Result:" -ForegroundColor Cyan
  $pushResult | Format-List | Out-String | Write-Host

  Write-Host "6. Testing direct fetch to GAS without 6s timeout to see true GAS response time..." -ForegroundColor Yellow
  $directFetch = Exec-Js @'
  (async () => {
    const gasUrl = getGasApiUrl();
    const startTime = Date.now();
    try {
      const payload = {
        tasks: state.tasks,
        habits: state.habits,
        goals: state.goals,
        manifesto: state.manifesto,
        taskPresets: state.taskPresets,
        metadata: {
          ...getSyncMetadata(),
          lastUpdatedDevice: 'INVESTIGATION_PROBE'
        }
      };
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      return {
        duration: Date.now() - startTime,
        status: response.status,
        responseText: text.substring(0, 300)
      };
    } catch (e) {
      return {
        duration: Date.now() - startTime,
        error: e.toString()
      };
    }
  })()
'@
  Write-Host "Direct fetch result:" -ForegroundColor Cyan
  $directFetch | Format-List | Out-String | Write-Host

} finally {
  Write-Host "7. Cleaning up browser process..." -ForegroundColor Yellow
  if ($ws -and $ws.State -eq 'Open') {
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait(2000) | Out-Null
  }
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 1
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Investigation run completed successfully." -ForegroundColor Green
}
