$res = Invoke-RestMethod -Uri 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec?action=pull' -Method Get -TimeoutSec 20
$habits = $res.data.habits
$tasks = $res.data.tasks

Write-Host "Total Habits: $($habits.Count)"
Write-Host "Total Tasks: $($tasks.Count)"

$today = Get-Date "2026-09-26"

# Check habit histories
$habitSummary = @()
foreach ($h in $habits) {
    $histProps = if ($h.history) { $h.history.PSObject.Properties } else { @() }
    $doneDays = @()
    foreach ($p in $histProps) {
        $val = $p.Value
        $isDone = ($val -eq $true) -or ($val.done -eq $true) -or ($val.count -gt 0)
        if ($isDone) {
            $doneDays += $p.Name
        }
    }
    
    # Sort done days desc
    $doneDays = $doneDays | Sort-Object -Descending
    
    $recentDone = $doneDays | Where-Object { $_ -ge "2026-09-15" }
    
    $habitSummary += [PSCustomObject]@{
        Id = $h.id
        Name = $h.name
        TotalDone = $doneDays.Count
        MaxDay = if ($doneDays.Count -gt 0) { $doneDays[0] } else { "-" }
        RecentDone = ($recentDone -join ", ")
    }
}

Write-Host "`n--- HABITS WITH RECENT COMPLETIONS (>= 2026-09-15) ---"
$recentHabits = $habitSummary | Where-Object { $_.RecentDone -ne "" }
$recentHabits | Format-Table -AutoSize | Out-String -Width 150 | Write-Host

Write-Host "`n--- HABITS WITH TOTAL DONE > 0 BUT NO RECENT DONE ---"
$oldHabits = $habitSummary | Where-Object { $_.TotalDone -gt 0 -and $_.RecentDone -eq "" }
Write-Host "Count of habits with older history: $($oldHabits.Count)"
$oldHabits | Select-Object -First 10 | Format-Table -AutoSize | Out-String -Width 150 | Write-Host

Write-Host "`n--- HABITS WITH 0 TOTAL DONE ---"
$zeroHabits = $habitSummary | Where-Object { $_.TotalDone -eq 0 }
Write-Host "Count of habits with 0 done: $($zeroHabits.Count)"
