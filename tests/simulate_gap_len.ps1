$res = Invoke-RestMethod -Uri 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec?action=pull' -Method Get -TimeoutSec 20
$habits = $res.data.habits

Write-Host "Simulating Continuity Bridge with gapLen <= 6..."

$simResults = @()

foreach ($h in $habits) {
    # Extract history
    $hist = @{}
    if ($h.history) {
        foreach ($p in $h.history.PSObject.Properties) {
            $val = $p.Value
            if (($val -eq $true) -or ($val.done -eq $true) -or ($val.count -gt 0)) {
                $hist[$p.Name] = $true
            }
        }
    }
    
    # 90 days past keys
    $pastKeys = @()
    $today = [DateTime]"2026-09-26"
    for ($i = 1; $i -le 90; $i++) {
        $pastKeys += $today.AddDays(-$i).ToString("yyyy-MM-dd")
    }
    
    $totalCompleted = ($pastKeys | Where-Object { $hist.ContainsKey($_) }).Count
    
    if ($totalCompleted -gt 0) {
        for ($i = 0; $i -lt $pastKeys.Count; $i++) {
            $k = $pastKeys[$i]
            if (-not $hist.ContainsKey($k)) {
                $gapLen = 1
                while (($i + $gapLen) -lt $pastKeys.Count -and (-not $hist.ContainsKey($pastKeys[$i + $gapLen]))) {
                    $gapLen++
                }
                
                # Check with gapLen <= 6 (covers full Silver Week + system outage up to 6 days)
                if ($gapLen -le 6 -and ($i + $gapLen -lt $pastKeys.Count) -and $hist.ContainsKey($pastKeys[$i + $gapLen])) {
                    for ($g = 0; $g -lt $gapLen; $g++) {
                        $gapKey = $pastKeys[$i + $g]
                        $hist[$gapKey] = $true
                    }
                }
                $i += ($gapLen - 1)
            }
        }
    }
    
    # Calculate streak from 2026-09-26
    $streak = 0
    $isTodayDone = $hist.ContainsKey("2026-09-26")
    $startOffset = if ($isTodayDone) { 0 } else { 1 }
    
    for ($i = $startOffset; $i -lt 365; $i++) {
        $checkDate = $today.AddDays(-$i).ToString("yyyy-MM-dd")
        if ($hist.ContainsKey($checkDate)) {
            $streak++
        } else {
            # 1-day grace period
            $prevDate = $today.AddDays(-($i + 1)).ToString("yyyy-MM-dd")
            if ($streak -gt 0 -and $hist.ContainsKey($prevDate)) {
                continue
            }
            break
        }
    }
    
    if ($streak -gt 0) {
        $simResults += [PSCustomObject]@{
            Id = $h.id
            Name = $h.name
            Section = $h.section
            Streak = $streak
            TodayDone = $isTodayDone
        }
    }
}

Write-Host "Total habits with active streaks under gapLen <= 6: $($simResults.Count)"
Write-Host "`nSample of restored streaks across different levels:"
$simResults | Sort-Object Streak -Descending | Format-Table -AutoSize | Out-String -Width 150 | Write-Host
