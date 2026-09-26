$res = Invoke-RestMethod -Uri 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec?action=pull' -Method Get -TimeoutSec 20
$habits = $res.data.habits

$shortList = $habits | Where-Object { 
    $p = if ($_.history) { $_.history.PSObject.Properties } else { @() }
    $p.Count -ge 1 -and $p.Count -le 10
}

Write-Host "Found $($shortList.Count) habits with 1-10 total history days."
foreach ($h in ($shortList | Select-Object -First 10)) {
    $days = ($h.history.PSObject.Properties | ForEach-Object { $_.Name }) -join ", "
    Write-Host "$($h.id): $($h.name) -> Days: $days"
}
