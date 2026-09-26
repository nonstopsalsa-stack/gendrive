$res = Invoke-RestMethod -Uri 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec?action=pull' -Method Get -TimeoutSec 20
$habits = $res.data.habits

Write-Host "================ ALL HABITS WITH LAST DONE >= 2026-09-18 ================"
$report = @()
foreach ($h in $habits) {
    $histProps = if ($h.history) { $h.history.PSObject.Properties } else { @() }
    $doneDays = @()
    foreach ($p in $histProps) {
        $val = $p.Value
        if (($val -eq $true) -or ($val.done -eq $true) -or ($val.count -gt 0)) {
            $doneDays += $p.Name
        }
    }
    $doneDays = $doneDays | Sort-Object -Descending
    if ($doneDays.Count -gt 0 -and $doneDays[0] -ge '2026-09-18') {
        $report += [PSCustomObject]@{
            Id = $h.id
            Name = $h.name
            Section = $h.section
            Total = $doneDays.Count
            Latest = $doneDays[0]
            Done26 = $doneDays -contains '2026-09-26'
            Done21 = $doneDays -contains '2026-09-21'
            Done20 = $doneDays -contains '2026-09-20'
            Done19 = $doneDays -contains '2026-09-19'
            Done18 = $doneDays -contains '2026-09-18'
        }
    }
}
$report | Sort-Object Total -Descending | Format-Table -AutoSize | Out-String -Width 150 | Write-Host
