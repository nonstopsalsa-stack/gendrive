$res = Invoke-RestMethod -Uri 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec?action=pull' -Method Get -TimeoutSec 20
$habits = $res.data.habits

$dist = $habits | ForEach-Object {
    $histProps = if ($_.history) { $_.history.PSObject.Properties } else { @() }
    $doneCount = 0
    foreach ($p in $histProps) {
        $val = $p.Value
        if (($val -eq $true) -or ($val.done -eq $true) -or ($val.count -gt 0)) {
            $doneCount++
        }
    }
    [PSCustomObject]@{
        Id = $_.id
        Name = $_.name
        TotalDone = $doneCount
    }
}

Write-Host "Distribution of Total Done across all 98 habits:"
$dist | Group-Object TotalDone | Sort-Object { [int]$_.Name } | Select-Object Name, Count | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "`nHabits with 1 to 14 Total Done:"
$dist | Where-Object { $_.TotalDone -ge 1 -and $_.TotalDone -le 14 } | Format-Table -AutoSize | Out-String -Width 150 | Write-Host
