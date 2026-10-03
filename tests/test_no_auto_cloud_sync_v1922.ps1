# Gendrive v1.9.22 verification: PC auto cloud sync removed / restoreStandardPresets removed / Drive backup intact
# Foreground run, prints progress to console. Exit code 1 on failure.
$ErrorActionPreference = 'Continue'
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " [TEST SUITE] Gendrive v1.9.22 No-Auto-Cloud-Sync Verification" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$tempDir = Join-Path $env:TEMP "edge_profile_v1922_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$port = 9522
Write-Host "[1/4] Starting headless Edge on port $port ..." -ForegroundColor Yellow
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

$passed = 0; $failed = 0
function Report($name, $pass, $detail = "") {
  if ($pass) { Write-Host "  [PASS] $name" -ForegroundColor Green; $script:passed++ }
  else { Write-Host "  [FAIL] $name - $detail" -ForegroundColor Red; $script:failed++ }
}

try {
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?about:blank"
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object System.Uri($page.webSocketDebuggerUrl)), $ct).Wait(8000) | Out-Null
  Write-Host "[2/4] Connected to CDP." -ForegroundColor Green
  $script:msgId = 0

  function Send-Cdp($method, $params) {
    $id = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
    $cmd = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Compress -Depth 8
    $bytes = [Text.Encoding]::UTF8.GetBytes($cmd)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait(10000) | Out-Null
    $deadline = (Get-Date).AddSeconds(40)
    while ((Get-Date) -lt $deadline) {
      $ms = New-Object System.IO.MemoryStream
      $buf = New-Object byte[] 65536
      do {
        $rs = New-Object System.ArraySegment[byte] -ArgumentList @(, $buf)
        $task = $ws.ReceiveAsync($rs, $ct)
        if (-not $task.Wait(40000)) { throw "CDP receive timeout" }
        $ms.Write($buf, 0, $task.Result.Count)
      } while (-not $task.Result.EndOfMessage)
      $json = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
      if ($json.id -eq $id) { return $json }
    }
    throw "CDP response timeout for $method"
  }

  Send-Cdp 'Page.enable' @{} | Out-Null
  Send-Cdp 'Page.addScriptToEvaluateOnNewDocument' @{ source = "window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));window.addEventListener('unhandledrejection',e=>window.__errs.push('UNHANDLED:'+String(e.reason)));" } | Out-Null
  $fileUrl = "file:///" + ((Get-Item (Join-Path $PSScriptRoot '..\index.html')).FullName.Replace('\', '/').Replace(' ', '%20'))
  Write-Host "[3/4] Navigating: $fileUrl" -ForegroundColor Yellow
  Send-Cdp 'Page.navigate' @{ url = $fileUrl } | Out-Null
  Start-Sleep -Seconds 5

  Write-Host "[4/4] Running verification suite ..." -ForegroundColor Yellow
  $js = @'
(async () => {
  const r = [];
  const add = (name, pass, detail) => r.push({ name, pass: !!pass, detail: String(detail === undefined ? '' : detail) });
  const sleep = ms => new Promise(x => setTimeout(x, ms));
  window.alert = () => {}; window.confirm = () => true;

  let retries = 0;
  while ((typeof setGasApiUrl === 'undefined' || typeof state === 'undefined' || typeof STORAGE_KEYS === 'undefined') && retries < 50) {
    await sleep(200);
    retries++;
  }

  add('No load-time errors (ReferenceError etc.)', window.__errs.length === 0, window.__errs.join(' | '));
  add('APP_VERSION is v1.9.22', typeof APP_VERSION !== 'undefined' && APP_VERSION === 'v1.9.22', typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined');

  // Removed functions
  ['triggerCloudSync','pushDataToCloud','pullDataFromCloud','initRealtimeSyncHeartbeat','restoreStandardPresets','testCloudSyncPull','testCloudSyncPush'].forEach(n =>
    add('Removed: ' + n + ' is undefined', typeof window[n] === 'undefined', typeof window[n]));
  add('UI: restore-standard-presets button absent', !document.getElementById('btn-restore-standard-presets'));
  add('UI: sync-status span kept', !!document.getElementById('sync-status'));

  // Kept functions
  ['getGasApiUrl','setGasApiUrl','exportToDriveFolder','fetchDriveBackupsList','importFromDriveBackup','getDriveFolderId','setDriveFolderId','mergeTaskPresetsDeep','openCloudSyncModal','saveCloudSyncSettings','clearCloudSyncSettings','reloadAppData'].forEach(n =>
    add('Kept: ' + n + ' is function', typeof window[n] === 'function', typeof window[n]));
  add('Kept: DEFAULT_GAS_URL / STORAGE_KEYS.GAS_URL / DEFAULT_TASK_PRESETS', typeof DEFAULT_GAS_URL !== 'undefined' && !!STORAGE_KEYS.GAS_URL && Array.isArray(DEFAULT_TASK_PRESETS));
  add('Kept: handleImportFromDriveSelect', typeof handleImportFromDriveSelect === 'function');
  add('Kept: isLocalDirty declared', typeof isLocalDirty !== 'undefined');

  // fetch spy
  const calls = [];
  const realFetch = window.fetch;
  window.fetch = (...a) => { calls.push(a); return Promise.reject(new Error('blocked-by-test')); };
  setGasApiUrl('https://script.google.com/macros/s/TEST_ID/exec');

  state.tasks = [{ id: 't_nosync', title: 'No Sync Task', section: 'morning', status: 'uncompleted' }];
  saveTasks();
  state.habits = [{ id: 'h_nosync', name: 'No Sync Habit', section: 'morning', status: 'uncompleted' }];
  saveHabits();
  if (typeof saveGoals === 'function') saveGoals();
  if (typeof saveManifesto === 'function') saveManifesto();
  if (typeof saveTaskPresets === 'function') saveTaskPresets();
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  await sleep(3200);
  add('1. fetch never called after saveTasks/Habits/Goals/Manifesto/Presets + focus (3.2s)', calls.length === 0, 'fetch calls: ' + calls.length);

  const st = document.getElementById('sync-status');
  // Unicode escape: \u540C\u671F\u30A8\u30E9\u30FC (同期エラー), \u30AF\u30E9\u30A6\u30C9 (クラウド)
  add('3. #sync-status is not "sync error"', st && !st.textContent.includes('\u540C\u671F\u30A8\u30E9\u30FC') && !st.textContent.includes('\u30AF\u30E9\u30A6\u30C9'), st && st.textContent);

  // reloadAppData
  let reloadErr = null;
  try { reloadAppData(); } catch (e) { reloadErr = e; }
  add('2. reloadAppData() runs without error', !reloadErr, reloadErr && reloadErr.message);
  // \u518D\u8AAD\u307F\u8FBC\u307F (再読み込み)
  add('2b. reloadAppData() shows local reload message', st.textContent.includes('\u518D\u8AAD\u307F\u8FBC\u307F'), st.textContent);
  add('2c. reloadAppData() made no fetch', calls.length === 0, calls.length);

  // updateSyncStatus variants never show error
  // \u4FDD\u5B58\u5B8C\u4E86 (保存完了)
  ['syncing','cloud_success','offline','cloud_error','local'].forEach(t => {
    updateSyncStatus(t);
    add('4. updateSyncStatus(' + t + ') never shows error', !st.textContent.includes('\u540C\u671F\u30A8\u30E9\u30FC') && st.textContent.includes('\u4FDD\u5B58\u5B8C\u4E86'), st.textContent);
  });

  // presets
  const merged = mergeTaskPresetsDeep([], []);
  add('5. mergeTaskPresetsDeep auto-supplements >= 11 practical presets', merged.length >= 11, merged.length);

  // Drive export equivalence
  setDriveFolderId('FOLDER_TEST_ID');
  window.fetch = (url, opt) => { calls.push([url, opt]); return Promise.resolve({ json: () => Promise.resolve({ status: 'success', fileId: 'x' }) }); };
  const before = calls.length;
  await exportToDriveFolder(false);
  await exportToDriveFolder(true);
  const p0 = JSON.parse(calls[before][1].body), p1 = JSON.parse(calls[before + 1][1].body);
  add('6a. exportToDriveFolder(false) -> HABIT_EXPORT_ / export_to_folder', p0.action === 'export_to_folder' && p0.fileName.startsWith('HABIT_EXPORT_') && p0.folderId === 'FOLDER_TEST_ID', p0.fileName);
  add('6b. exportToDriveFolder(true) -> AUTO_BACKUP_ / export_to_folder', p1.action === 'export_to_folder' && p1.fileName.startsWith('AUTO_BACKUP_'), p1.fileName);
  add('6c. export payload has 5 data keys', ['habits','tasks','goals','manifesto','taskPresets'].every(k => k in p0.data));
  const callsBeforeSave = calls.length;
  document.getElementById('cloud-sync-gas-url').value = 'https://script.google.com/macros/s/TEST_ID2/exec';
  saveCloudSyncSettings();
  add('6d. saveCloudSyncSettings saves URL only (no fetch)', calls.length === callsBeforeSave && getGasApiUrl().endsWith('TEST_ID2/exec'), calls.length - callsBeforeSave);
  openCloudSyncModal();
  const m = document.getElementById('modal-cloud-sync');
  add('6e. #modal-cloud-sync opens', m && m.classList.contains('active'));
  closeModal();
  add('6f. #modal-cloud-sync closes', m && !m.classList.contains('active'));
  // \u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u540C\u671F (リアルタイム同期), \u30AF\u30E9\u30A6\u30C9\u304B\u3089\u53D6\u5F97 (クラウドから取得)
  add('6g. Modal text no longer promises realtime sync', !m.textContent.includes('\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u540C\u671F') && !m.textContent.includes('\u30AF\u30E9\u30A6\u30C9\u304B\u3089\u53D6\u5F97'));

  window.fetch = realFetch;
  add('7. No runtime errors accumulated', window.__errs.length === 0, window.__errs.join(' | '));
  return r;
})()
'@
  $resp = Send-Cdp 'Runtime.evaluate' @{ expression = $js; returnByValue = $true; awaitPromise = $true }
  if ($resp.result.exceptionDetails) {
    Write-Host "JS EXCEPTION: $($resp.result.exceptionDetails.exception.description)" -ForegroundColor Red
    Write-Host "Line: $($resp.result.exceptionDetails.lineNumber), Col: $($resp.result.exceptionDetails.columnNumber)" -ForegroundColor Red
    $failed++
  }
  if ($resp.result.result.value) {
    foreach ($t in $resp.result.result.value) { Report $t.name $t.pass $t.detail }
  }
}
catch { Write-Host "SCRIPT ERROR: $_" -ForegroundColor Red; $failed++ }
finally {
  if ($ws -and $ws.State -eq 'Open') { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait(2000) | Out-Null }
  if ($edge -and -not $edge.HasExited) { Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " TOTAL: $($passed + $failed) | PASSED: $passed | FAILED: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "====================================================" -ForegroundColor Cyan
if ($failed -gt 0) { exit 1 }
