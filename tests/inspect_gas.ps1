$c = Get-Content 'temp_gas.json' -Encoding UTF8 -Raw | ConvertFrom-Json
Write-Host "Keys in temp_gas:"
$c | Get-Member -MemberType NoteProperty | ForEach-Object { $_.Name }
Write-Host "Status:" $c.status
Write-Host "Keys in data:"
$c.data | Get-Member -MemberType NoteProperty | ForEach-Object { $_.Name }
Write-Host "Metadata:" ($c.data.metadata | ConvertTo-Json -Compress)
Write-Host "Habits count:" $c.data.habits.Count
Write-Host "Tasks count:" $c.data.tasks.Count

Write-Host "`n--- Checking H088 in temp_gas ---"
$h088 = $c.data.habits | Where-Object { $_.id -eq 'H088' }
$h088 | ConvertTo-Json -Depth 5
