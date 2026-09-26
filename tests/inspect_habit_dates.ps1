$res = Invoke-RestMethod -Uri 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec?action=pull' -Method Get -TimeoutSec 20
$habits = $res.data.habits

$targetIds = @('H043', 'H088', 'H089', 'H040', 'H042', 'H039', 'H041', 'H069')

foreach ($id in $targetIds) {
    $h = $habits | Where-Object { $_.id -eq $id }
    if ($h) {
        Write-Host "================== $($h.id): $($h.name) =================="
        $histKeys = if ($h.history) { ($h.history.PSObject.Properties | ForEach-Object { $_.Name }) | Sort-Object } else { @() }
        Write-Host "Total history keys: $($histKeys.Count)"
        
        $septKeys = $histKeys | Where-Object { $_ -ge '2026-09-01' }
        Write-Host "September done keys ($($septKeys.Count)): $($septKeys -join ', ')"
        
        $logs = if ($h.executionLogs) { $h.executionLogs } else { @() }
        Write-Host "ExecutionLogs count: $($logs.Count)"
        $recentLogs = $logs | Where-Object { $_.dateKey -ge '2026-09-01' -or $_.completedAt -ge '2026-09-01' }
        Write-Host "Recent logs dates: $(( $recentLogs | ForEach-Object { if ($_.dateKey) { $_.dateKey } else { $_.completedAt.Substring(0,10) } } ) -join ', ')"
    }
}
