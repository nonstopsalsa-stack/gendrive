$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "mobile_err_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9276
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "mobile.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object Uri($page.webSocketDebuggerUrl)), $ct).Wait()

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
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $buf = New-Object byte[] 10485760
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.exceptionDetails) {
      Write-Host "JS EXCEPTION: $($json.result.exceptionDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
    }
    return $json.result.result.value
  }

  $res = Exec-Js @'
(async () => {
  const logs = [];
  try {
    logs.push("mState exists: " + (typeof mState !== 'undefined'));
    logs.push("Tasks in mState: " + (mState ? mState.tasks.length : 0));
    logs.push("Habits in mState: " + (mState ? mState.habits.length : 0));
    logs.push("activeScope: " + (mState ? mState.activeScope : ''));
    logs.push("activeType: " + (mState ? mState.activeType : ''));

    // Try rendering
    renderMobileApp();
    logs.push("renderMobileApp() succeeded without throwing");

    const container = document.getElementById('m-task-list');
    logs.push("Container HTML length: " + (container ? container.innerHTML.length : 0));
    logs.push("Rendered cards count: " + document.querySelectorAll('.m-card-item, .task-card, .habit-card, .m-card-task, .m-card-habit').length);

    // Try pulling from cloud
    const gasUrl = getGasUrl();
    logs.push("getGasUrl(): " + (gasUrl ? gasUrl.slice(0, 30) + '...' : 'EMPTY!'));

  } catch(e) {
    logs.push("ERROR: " + e.message + " \nStack: " + e.stack);
  }
  return logs;
})()
'@

  Write-Host "Diagnostic Output:"
  $res | ForEach-Object { Write-Host $_ }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
