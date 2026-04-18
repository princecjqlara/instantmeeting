Add-Type -AssemblyName System.Drawing
$src = Join-Path $PSScriptRoot '..\public\gcash-qr.jpg'
$dst = Join-Path $PSScriptRoot '..\public\gcash-qr-crop.jpg'
$img = [System.Drawing.Image]::FromFile($src)
$w = $img.Width
$h = $img.Height
Write-Host "source ${w}x${h}"

# Crop to the white card (contains QR + name + mobile + user id)
# Source card measured visually: about 9% margin on sides, ~19% top, ~77% bottom.
$left = [int]($w * 0.08)
$top = [int]($h * 0.19)
$right = [int]($w * 0.92)
$bottom = [int]($h * 0.78)
$cw = $right - $left
$ch = $bottom - $top

$rect = New-Object System.Drawing.Rectangle($left, $top, $cw, $ch)
$bmp = New-Object System.Drawing.Bitmap($cw, $ch)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $cw, $ch)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$img.Dispose()

$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Dispose()
Write-Host "wrote $dst (${cw}x${ch})"
