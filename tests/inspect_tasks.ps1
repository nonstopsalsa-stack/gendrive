$res = Invoke-RestMethod -Uri 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec?action=pull' -Method Get -TimeoutSec 20
$tasks = $res.data.tasks

Write-Host "Total tasks: $($tasks.Count)"

$byStatus = $tasks | Group-Object status
$byStatus | Select-Object Name, Count | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "`nCompleted tasks sample (dates):"
$completedTasks = $tasks | Where-Object { $_.status -eq 'completed' }
Write-Host "Completed count: $($completedTasks.Count)"

$byDate = $completedTasks | Group-Object date
$byDate | Sort-Object Name -Descending | Select-Object -First 15 | Select-Object Name, Count | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "`nRecurring tasks sample:"
$rec = $tasks | Where-Object { $_.type -eq 'recurring' }
$rec | Select-Object id, title, type, @{n='history';e={ $_.history | ConvertTo-Json -Compress }} | Format-List | Out-String | Write-Host
