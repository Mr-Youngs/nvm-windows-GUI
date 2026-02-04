Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile('c:\Users\Y\Desktop\nvm-windows-GUI\src\assets\logo.png')
$image.Save('c:\Users\Y\Desktop\nvm-windows-GUI\src\assets\logo_converted.png', [System.Drawing.Imaging.ImageFormat]::Png)
$image.Dispose()
Move-Item 'c:\Users\Y\Desktop\nvm-windows-GUI\src\assets\logo_converted.png' 'c:\Users\Y\Desktop\nvm-windows-GUI\src\assets\logo.png' -Force
