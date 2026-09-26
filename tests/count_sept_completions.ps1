$res = Invoke-RestMethod -Uri 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec?action=pull' -Method Get -TimeoutSec 20
$habits = $res.data.habits
$tasks = $res.data.tasks

Write-Host "Completions by date in September 2026 across ALL habits:"
$allHabitCompletions = @{}
foreach ($h in $habits) {
    if ($h.history) {
        foreach ($p in $h.history.PSObject.Properties) {
            $val = $p.Value
            if (($val -eq $true) -or ($val.done -eq $true) -or ($val.count -gt 0)) {
                $d = $p.Name
                if ($d -like "2026-09-*") {
                    $allHabitCompletions[$d] = ($allHabitCompletions[$d] + 1)
                }
            }
        }
    }
}
$allHabitCompletions.GetEnumerator() | Sort-Object Name | Select-Object Name, Value | Format-Table -AutoSize | Out-String | Write-Host
