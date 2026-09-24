$ErrorActionPreference = 'Stop'

$launcherDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $launcherDir '..\..')
$sourcePath = Join-Path $launcherDir 'Program.cs'
$iconPath = Join-Path $projectDir 'img\wxnn.ico'
$outputPath = Join-Path $projectDir 'Infinity-Nikki-Album-Manager-Launcher.exe'
$legacyLauncherName = [string]::Concat([char]0x65e0, [char]0x9650, [char]0x6696, [char]0x6696, [char]0x76f8, [char]0x518c, [char]0x542f, [char]0x52a8, [char]0x5668, '.exe')
$launcherName = [string]::Concat([char]0x7f51, [char]0x7ad9, [char]0x542f, [char]0x52a8, [char]0x5668, '.exe')
$legacyLauncherPath = Join-Path $projectDir $legacyLauncherName
$launcherPath = Join-Path $projectDir $launcherName
$cscPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

if (-not (Test-Path $cscPath)) {
  $cscPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}

if (-not (Test-Path $cscPath)) {
  throw '未找到 Windows 自带的 C# 编译器 csc.exe'
}

if (-not (Test-Path $iconPath)) {
  throw "未找到图标文件：$iconPath"
}

if (Test-Path -LiteralPath $launcherPath) {
  [IO.File]::Delete($launcherPath)
}

if (Test-Path -LiteralPath $legacyLauncherPath) {
  [IO.File]::Delete($legacyLauncherPath)
}

& $cscPath /nologo /target:winexe /platform:anycpu /win32icon:"$iconPath" /reference:System.Windows.Forms.dll /out:"$outputPath" "$sourcePath"
if ($LASTEXITCODE -ne 0) {
  throw 'Launcher compilation failed.'
}

if (-not (Test-Path -LiteralPath $outputPath)) {
  throw "未生成临时启动器：$outputPath"
}

if (Test-Path -LiteralPath $launcherPath) {
  [IO.File]::Delete($launcherPath)
}

Move-Item -LiteralPath $outputPath -Destination $launcherPath

Write-Host "已生成：$launcherPath"
