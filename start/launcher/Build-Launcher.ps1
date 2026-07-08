$ErrorActionPreference = 'Stop'

$launcherDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $launcherDir '..\..')
$sourcePath = Join-Path $launcherDir 'Program.cs'
$iconPath = Join-Path $projectDir 'img\wxnn.ico'
$outputPath = Join-Path $projectDir 'Start-Project.exe'
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

Write-Host "已生成：$outputPath"
