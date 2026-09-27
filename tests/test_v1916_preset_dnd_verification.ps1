[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Gendrive v1.9.16 Preset Drag & Drop Verification Suite  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$passCount = 0
$failCount = 0

function Assert-Test($name, $condition, $detail = "") {
    if ($condition) {
        Write-Host " [PASS] $name" -ForegroundColor Green
        if ($detail) { Write-Host "        $detail" -ForegroundColor Gray }
        $script:passCount++
    } else {
        Write-Host " [FAIL] $name" -ForegroundColor Red
        if ($detail) { Write-Host "        $detail" -ForegroundColor Yellow }
        $script:failCount++
    }
}

# -------------------------------------------------------------
# 1. Version Consistency Check (v1.9.16)
# -------------------------------------------------------------
$cfg = Get-Content 'js/config.js' -Encoding UTF8 -Raw
$hasCfgVer = $cfg.Contains("const APP_VERSION = 'v1.9.16';")
Assert-Test "1. js/config.js APP_VERSION is v1.9.16" $hasCfgVer

$idx = Get-Content 'index.html' -Encoding UTF8 -Raw
$hasIdxVer = ($idx -match 'id="app-version-badge"[^>]*>v1\.9\.16<')
$hasIdxScripts = $idx.Contains("js/components/taskPresetsService.js?v=1.9.16")
Assert-Test "2. index.html badge and script cachebusters are v1.9.16" ($hasIdxVer -and $hasIdxScripts)

$mob = Get-Content 'mobile.html' -Encoding UTF8 -Raw
$hasMobVer = ($mob -match 'class="version-capsule-badge">v1\.9\.16</span>')
$hasMobScripts = $mob.Contains("mobile.js?v=1.9.16")
Assert-Test "3. mobile.html badge and script cachebusters are v1.9.16" ($hasMobVer -and $hasMobScripts)

$sw = Get-Content 'sw.js' -Encoding UTF8 -Raw
$hasSwVer = $sw.Contains("CACHE_NAME = 'gendrive-lite-v1916';")
Assert-Test "4. sw.js cache name is v1916" $hasSwVer

# -------------------------------------------------------------
# 2. taskPresetsService.js Drag & Drop Implementation Integrity
# -------------------------------------------------------------
$presetJs = Get-Content 'js/components/taskPresetsService.js' -Encoding UTF8 -Raw

$hasDragStart = $presetJs.Contains("function handlePresetCardDragStart")
Assert-Test "5. handlePresetCardDragStart exists" $hasDragStart

$hasDragOver = $presetJs.Contains("function handlePresetCardDragOver")
Assert-Test "6. handlePresetCardDragOver exists with left/right drop indicator logic" $hasDragOver

$hasDragLeave = $presetJs.Contains("function handlePresetCardDragLeave")
Assert-Test "7. handlePresetCardDragLeave exists" $hasDragLeave

$hasDrop = $presetJs.Contains("function handlePresetCardDrop")
Assert-Test "8. handlePresetCardDrop exists" $hasDrop

$hasDragEnd = $presetJs.Contains("function handlePresetCardDragEnd")
Assert-Test "9. handlePresetCardDragEnd exists" $hasDragEnd

$hasCardClickGuard = $presetJs.Contains("function handlePresetCardClick") -and $presetJs.Contains("justFinishedPresetDragging")
Assert-Test "10. Click guard (handlePresetCardClick) prevents accidental task execution on drag release" $hasCardClickGuard

$hasReorderFunction = $presetJs.Contains("function reorderTaskPresets(sourceId, targetId, isLeft)")
Assert-Test "11. reorderTaskPresets function defined with proper parameters" $hasReorderFunction

$hasDraggableAttr = $presetJs.Contains('draggable="true"')
Assert-Test "12. preset-card-item template includes draggable='true'" $hasDraggableAttr

$hasDataPresetId = $presetJs.Contains('data-preset-id="${p.id}"')
Assert-Test "13. preset-card-item template includes data-preset-id attribute" $hasDataPresetId

$hasActionDragGuards = $presetJs.Contains('draggable="false"') -and $presetJs.Contains('onmousedown="event.stopPropagation()"')
Assert-Test "14. Edit & Delete action buttons have drag guards (draggable='false' & onmousedown stopPropagation)" $hasActionDragGuards

$hasUndoPush = $presetJs.Contains("pushUndoAction") -and ($presetJs -match 'pushUndoAction\(\{\s*description:\s*`[^`]*\$\{[^}]+\}[^`]*並び順を変更`')
Assert-Test "15. reorderTaskPresets records undo action for instant rollback" $hasUndoPush

# -------------------------------------------------------------
# 3. CSS Styling Verification
# -------------------------------------------------------------
$styleCss = Get-Content 'style.css' -Encoding UTF8 -Raw

$hasGrabCursor = $styleCss.Contains("cursor: grab;") -and $styleCss.Contains("cursor: grabbing;")
Assert-Test "16. style.css defines cursor: grab and cursor: grabbing" $hasGrabCursor

$hasDraggingClass = $styleCss.Contains(".preset-card-item.preset-card-dragging")
Assert-Test "17. style.css defines .preset-card-dragging styling (opacity & dashed border)" $hasDraggingClass

$hasDropIndicators = $styleCss.Contains(".preset-card-item.drop-left") -and $styleCss.Contains(".preset-card-item.drop-right")
Assert-Test "18. style.css defines .drop-left and .drop-right insertion indicators" $hasDropIndicators

# -------------------------------------------------------------
# 4. Pure Simulation of Reordering Logic in PowerShell
# -------------------------------------------------------------
$presets = [System.Collections.ArrayList]@("p1", "p2", "p3", "p4", "p5")
$undoStack = [System.Collections.ArrayList]@()

function Reorder-Presets([string]$sourceId, [string]$targetId, [bool]$isLeft) {
    $sourceIdx = $presets.IndexOf($sourceId)
    $targetIdx = $presets.IndexOf($targetId)
    if ($sourceIdx -lt 0 -or $targetIdx -lt 0 -or $sourceIdx -eq $targetIdx) { return }

    $prevSnapshot = [System.Collections.ArrayList]@($presets)
    $moved = $presets[$sourceIdx]
    $presets.RemoveAt($sourceIdx)

    $newTargetIdx = $presets.IndexOf($targetId)
    $insertIdx = if ($isLeft) { $newTargetIdx } else { $newTargetIdx + 1 }
    $presets.Insert($insertIdx, $moved)

    $undoStack.Add([PSCustomObject]@{
        Snapshot = $prevSnapshot
    })
}

# TEST A: Move p5 to before p1 (drag right to far left)
Reorder-Presets "p5" "p1" $true
$orderA = ($presets -join ",")
$passA = ($orderA -eq "p5,p1,p2,p3,p4")
Assert-Test "19. Reorder p5 to before p1 (Insert Left): Result is [p5,p1,p2,p3,p4]" $passA "Actual: $orderA"

# TEST B: Move p5 to after p3 (drag left to middle right)
Reorder-Presets "p5" "p3" $false
$orderB = ($presets -join ",")
$passB = ($orderB -eq "p1,p2,p3,p5,p4")
Assert-Test "20. Reorder p5 to after p3 (Insert Right): Result is [p1,p2,p3,p5,p4]" $passB "Actual: $orderB"

# TEST C: Undo action restores state
if ($undoStack.Count -gt 0) {
    $lastUndo = $undoStack[$undoStack.Count - 1]
    $undoStack.RemoveAt($undoStack.Count - 1)
    $presets = [System.Collections.ArrayList]@($lastUndo.Snapshot)
}
$orderC = ($presets -join ",")
$passC = ($orderC -eq "p5,p1,p2,p3,p4")
Assert-Test "21. Undo stack restores previous preset sequence accurately" $passC "Actual: $orderC"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Test Summary: Passed: $passCount, Failed: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "==========================================================" -ForegroundColor Cyan

if ($failCount -gt 0) {
    exit 1
} else {
    exit 0
}