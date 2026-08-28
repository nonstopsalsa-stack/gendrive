Add-Type -AssemblyName System.Drawing

$baseDir = "c:\Users\nonst\recover\obsidian folder\006_AI_Workspace\habit-app"
$icoPath = Join-Path $baseDir "gendrive.ico"
$indexPath = Join-Path $baseDir "index.html"
$programsFolder = [System.Environment]::GetFolderPath('Programs')
$desktopFolder = [System.Environment]::GetFolderPath('Desktop')

# 1. Super High-Quality Neon Thunderbolt Icon (Multi-res: 256, 64, 48, 32, 16)
function Create-GendriveArtwork {
    param([int]$size)

    $bmp = [System.Drawing.Bitmap]::new($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $scale = $size / 256.0

    # Squircle Background (#070D1E -> #0F172A)
    $pad = 12.0 * $scale
    $rectW = $size - ($pad * 2)
    $rectH = $size - ($pad * 2)
    $radius = 48.0 * $scale

    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($pad, $pad, $radius * 2, $radius * 2, 180, 90)
    $path.AddArc($pad + $rectW - ($radius * 2), $pad, $radius * 2, $radius * 2, 270, 90)
    $path.AddArc($pad + $rectW - ($radius * 2), $pad + $rectH - ($radius * 2), $radius * 2, $radius * 2, 0, 90)
    $path.AddArc($pad, $pad + $rectH - ($radius * 2), $radius * 2, $radius * 2, 90, 90)
    $path.CloseFigure()

    $gradBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.PointF]::new(0, 0),
        [System.Drawing.PointF]::new($size, $size),
        [System.Drawing.Color]::FromArgb(255, 7, 13, 30),
        [System.Drawing.Color]::FromArgb(255, 15, 23, 42)
    )
    $g.FillPath($gradBrush, $path)
    $gradBrush.Dispose()

    # Outer Border gradient (Cyan #38BDF8)
    $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 56, 189, 248), [Math]::Max(1.5, 6.0 * $scale))
    $g.DrawPath($borderPen, $path)
    $borderPen.Dispose()

    # Inner Glass Border (Indigo #818CF8)
    $innerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(120, 129, 140, 248), [Math]::Max(1.0, 2.0 * $scale))
    $g.DrawPath($innerPen, $path)
    $innerPen.Dispose()

    # Dynamic Thunderbolt Polygon
    $pts = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(148 * $scale, 32 * $scale),
        [System.Drawing.PointF]::new(76 * $scale, 136 * $scale),
        [System.Drawing.PointF]::new(128 * $scale, 136 * $scale),
        [System.Drawing.PointF]::new(104 * $scale, 224 * $scale),
        [System.Drawing.PointF]::new(184 * $scale, 114 * $scale),
        [System.Drawing.PointF]::new(134 * $scale, 114 * $scale)
    )

    # Outer Glow
    if ($size -ge 48) {
        $glowPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(80, 250, 204, 21), 18.0 * $scale)
        $glowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $g.DrawPolygon($glowPen, $pts)
        $glowPen.Dispose()
    }

    # Main Bolt Fill (Golden Amber #FBBF24 -> Electric Yellow #FDE047)
    $boltBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.PointF]::new(76 * $scale, 32 * $scale),
        [System.Drawing.PointF]::new(184 * $scale, 224 * $scale),
        [System.Drawing.Color]::FromArgb(255, 250, 204, 21),
        [System.Drawing.Color]::FromArgb(255, 253, 224, 71)
    )
    $g.FillPolygon($boltBrush, $pts)
    $boltBrush.Dispose()

    # Specular Core Highlight
    if ($size -ge 32) {
        $corePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(230, 255, 255, 255), [Math]::Max(1.0, 3.5 * $scale))
        $corePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $corePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $g.DrawLine($corePen, 138 * $scale, 52 * $scale, 96 * $scale, 126 * $scale)
        $g.DrawLine($corePen, 122 * $scale, 144 * $scale, 114 * $scale, 196 * $scale)
        $corePen.Dispose()
    }

    $path.Dispose()
    $g.Dispose()
    return $bmp
}

$sizes = @(256, 64, 48, 32, 16)
$bitmaps = @()
foreach ($s in $sizes) {
    $bitmaps += (Create-GendriveArtwork -size $s)
}

# Save Preview PNG
$previewPath = Join-Path $baseDir "gendrive_preview.png"
$bitmaps[0].Save($previewPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Pack into multi-res .ico
$ms = [System.IO.MemoryStream]::new()
$bw = [System.IO.BinaryWriter]::new($ms)
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$bitmaps.Count)

$pngList = @()
foreach ($b in $bitmaps) {
    $pms = [System.IO.MemoryStream]::new()
    $b.Save($pms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngList += $pms
}

$offset = 6 + (16 * $bitmaps.Count)
for ($i = 0; $i -lt $bitmaps.Count; $i++) {
    $b = $bitmaps[$i]
    $pms = $pngList[$i]
    $w = if ($b.Width -ge 256) { 0 } else { [byte]$b.Width }
    $h = if ($b.Height -ge 256) { 0 } else { [byte]$b.Height }

    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$pms.Length)
    $bw.Write([uint32]$offset)
    $offset += $pms.Length
}

foreach ($pms in $pngList) {
    $bytes = $pms.ToArray()
    $bw.Write($bytes, 0, $bytes.Length)
    $pms.Dispose()
}

$bw.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$bw.Close()
$ms.Dispose()

foreach ($b in $bitmaps) { $b.Dispose() }
Write-Host "Generated multi-resolution gendrive.ico"

# 2. Browser Detection
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$browserExe = if (Test-Path $chromePath) { $chromePath } elseif (Test-Path $edgePath) { $edgePath } else { "" }

$fileUrl = "file:///" + ($indexPath -replace '\\', '/')
$target = if ($browserExe) { $browserExe } else { $fileUrl }
$arguments = if ($browserExe) { "--app=""$fileUrl""" } else { "" }

# 3. Create / Update Shortcuts (Desktop & Start Menu)
$wsh = New-Object -ComObject WScript.Shell

$shortcutPaths = @(
    (Join-Path $desktopFolder "Gendrive.lnk"),
    (Join-Path $programsFolder "Gendrive.lnk")
)

foreach ($scPath in $shortcutPaths) {
    $sc = $wsh.CreateShortcut($scPath)
    $sc.TargetPath = $target
    if ($arguments) { $sc.Arguments = $arguments }
    $sc.IconLocation = "$icoPath,0"
    $sc.Description = "Gendrive - Action & Habit Execution Engine"
    $sc.WorkingDirectory = $baseDir
    $sc.Save()
    Write-Host "Created shortcut: $scPath"
}

Write-Host "SUCCESS: Gendrive is ready for Start Menu & Taskbar pinning!" -ForegroundColor Green
