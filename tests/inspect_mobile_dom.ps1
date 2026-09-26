$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "check_err_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9272
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  # 1. Test mobile.html
  $mobileUrl = "file:///" + ((Get-Item "mobile.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9272/json/new?$mobileUrl"
  Start-Sleep -Seconds 2

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object Uri($page.webSocketDebuggerUrl)), $ct).Wait()

  # Enable Runtime and Console
  function Send-Cdp($method, $params = @{}) {
    $cmd = @{ id = [System.Threading.Interlocked]::Increment([ref]$script:msgId); method = $method; params = $params } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  }

  $script:msgId = 0
  Send-Cdp "Console.enable"
  Send-Cdp "Runtime.enable"
  Start-Sleep -Seconds 1

  # Evaluate mobile errors
  $cmdEval = @{
    id = 999
    method = "Runtime.evaluate"
    params = @{
      expression = @'
(() => {
  return {
    stateTasks: typeof state !== 'undefined' && state.tasks ? state.tasks.length : 'no state.tasks',
    stateHabits: typeof state !== 'undefined' && state.habits ? state.habits.length : 'no state.habits',
    domTasks: document.querySelectorAll('.m-task-card, .task-card').length,
    domHabits: document.querySelectorAll('.m-habit-card, .habit-card').length,
    bodyHtmlSnippet: document.body.innerHTML.slice(0, 300)
  };
})()
'@
      returnByValue = $true
    }
  } | ConvertTo-Json -Compress

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmdEval)
  $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  Start-Sleep -Seconds 1

  $buf = New-Object byte[] 1048576
  $res = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)), $ct).Result
  $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
  Write-Host "Mobile evaluation response:"
  Write-Host $resText

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
