$res = Invoke-RestMethod -Uri 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec?action=pull' -Method Get -TimeoutSec 20
$habits = $res.data.habits
$tasks = $res.data.tasks

Write-Host "================ ALL HABITS WITH >0 DONE ================"
$hList = @()
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
    $lastDone = if ($doneDays.Count -gt 0) { $doneDays[0] } else { "-" }
    
    $hList += [PSCustomObject]@{
        Id = $h.id
        Name = $h.name
        Section = $h.section
        TotalDone = $doneDays.Count
        LastDone = $lastDone
        Weekdays = ($h.weekdays -join ",")
        RecType = $h.recType
    }
}

$hList | Sort-Object TotalDone -Descending | Select-Object -First 30 | Format-Table -AutoSize | Out-String -Width 150 | Write-Host

Write-Host "================ RECURRING TASKS ================"
$recTasks = $tasks | Where-Object { $_.type -eq "recurring" }
Write-Host "Recurring Tasks count: $($recTasks.Count)"
$tList = @()
foreach ($t in $recTasks) {
    $hist = if ($t.history) { $t.history } else { @() }
    $doneDays = @()
    foreach ($entry in $hist) {
        $d = if ($entry.date) { $entry.date } elseif ($entry -is [string]) { $entry } else { $null }
        if ($d) { $doneDays += $d }
    }
    $doneDays = $doneDays | Sort-Object -Descending
    $lastDone = if ($doneDays.Count -gt 0) { $doneDays[0] } else { "-" }
    
    $tList += [PSCustomObject]@{
        Id = $t.id
        Title = $t.title
        TotalDone = $doneDays.Count
        LastDone = $lastDone
        RecType = $t.recType
    }
}
$tList | Sort-Object TotalDone -Descending | Format-Table -AutoSize | Out-String -Width 150 | Write-Host
