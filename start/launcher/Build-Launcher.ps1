$ErrorActionPreference = 'Stop'

$launcherDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $launcherDir '..\..')
$sourcePath = Join-Path $launcherDir 'Program.cs'
$iconPath = Join-Path $projectDir 'img\wxnn.ico'
$outputPath = Join-Path $projectDir 'Infinity-Nikki-Album-Manager-Launcher.exe'
$launcherItem = Get-ChildItem -LiteralPath $projectDir -Filter '*.exe' -File |
  Where-Object { $_.Name -ne (Split-Path -Leaf $outputPath) } |
  Select-Object -First 1

if (-not $launcherItem) {
  throw 'Root launcher EXE was not found; cannot determine the output file name.'
}

$launcherPath = $launcherItem.FullName
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

& $cscPath /nologo /target:winexe /platform:anycpu /win32icon:"$iconPath" /reference:System.Windows.Forms.dll /out:"$outputPath" "$sourcePath"

if (Test-Path -LiteralPath $launcherPath) {
  [IO.File]::Delete($launcherPath)
}
[IO.File]::Move($outputPath, $launcherPath)

Write-Host "已生成：$launcherPath"
