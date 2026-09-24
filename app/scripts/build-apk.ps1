param(
  [switch]$Install,
  [switch]$Clean,
  [switch]$AllAbis,
  [string]$ApiUrl = $(if ($env:EXPO_PUBLIC_API_URL) { $env:EXPO_PUBLIC_API_URL } else { 'https://api.141-148-193-78.sslip.io' }),
  [string]$Toolchain = 'D:\android-toolchain'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$App = Join-Path $Root 'app'
$Out = Join-Path $Root 'build'
$Jdk = Join-Path $Toolchain 'jdk17'
$Sdk = Join-Path $Toolchain 'sdk'
$CmdlineToolsUrl = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'
$JdkUrl = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse'

New-Item -ItemType Directory -Force -Path $Out | Out-Null
Start-Transcript -Path (Join-Path $Out 'build.log') -Append | Out-Null

Add-Type -Namespace Win -Name Power -MemberDefinition '[System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);'
[void][Win.Power]::SetThreadExecutionState([uint32]2147483651)

function Step($n, $text) { Write-Host ""; Write-Host "=== [$n] $text ===" -ForegroundColor Cyan }
function Fail($text) { Write-Host "FAILED: $text" -ForegroundColor Red; Stop-Transcript | Out-Null; exit 1 }
function Run($exe, [string[]]$arguments) {
  & $exe @arguments
  if ($LASTEXITCODE -ne 0) { Fail "$exe $($arguments -join ' ') exited with $LASTEXITCODE" }
}

if ($Root -match ' ') { Fail "the project path contains a space: $Root`nThe native build cannot handle it. Rename the folder (for example D:\CardGame) and run again." }
if ($Root.Length -gt 40) { Write-Host "Warning: long project path ($($Root.Length) characters). Native builds can exceed Windows path limits; a short path like D:\CardGame is safest." -ForegroundColor Yellow }
if (-not (Test-Path (Join-Path $App 'app.json'))) { Fail "no app\app.json under $Root" }
New-Item -ItemType Directory -Force -Path $Toolchain | Out-Null

Step 1 'JDK 17 (Temurin)'
if (-not (Test-Path (Join-Path $Jdk 'bin\java.exe'))) {
  $zip = Join-Path $Toolchain 'jdk17.zip'
  Write-Host 'downloading JDK 17 (~180 MB)'
  Invoke-WebRequest -Uri $JdkUrl -OutFile $zip
  $tmp = Join-Path $Toolchain 'jdk-tmp'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp
  $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
  if (Test-Path $Jdk) { Remove-Item -Recurse -Force $Jdk }
  Move-Item $inner.FullName $Jdk
  Remove-Item -Recurse -Force $tmp, $zip
}
$env:JAVA_HOME = $Jdk
$env:PATH = "$Jdk\bin;$env:PATH"
Run 'java' @('-version')

Step 2 'Android command-line tools'
function Find-SdkManager {
  $dirs = Get-ChildItem (Join-Path $Sdk 'cmdline-tools') -Directory -ErrorAction SilentlyContinue
  $found = foreach ($d in $dirs) {
    $bat = Join-Path $d.FullName 'bin\sdkmanager.bat'
    $props = Join-Path $d.FullName 'source.properties'
    if ((Test-Path $bat) -and (Test-Path $props)) {
      $m = Select-String -Path $props -Pattern '^Pkg\.Revision=(\d+)'
      if ($m) { [pscustomobject]@{ Bat = $bat; Rev = [int]$m.Matches[0].Groups[1].Value } }
    }
  }
  $classic = $found | Where-Object { $_.Rev -lt 16 } | Sort-Object Rev -Descending | Select-Object -First 1
  if ($classic) { return $classic.Bat }
  return ($found | Sort-Object Rev -Descending | Select-Object -First 1).Bat
}
$sdkmanager = Find-SdkManager
if (-not $sdkmanager) {
  $zip = Join-Path $Toolchain 'cmdline-tools.zip'
  Write-Host 'downloading command-line tools (~150 MB)'
  Invoke-WebRequest -Uri $CmdlineToolsUrl -OutFile $zip
  $tmp = Join-Path $Toolchain 'cmdline-tmp'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp
  New-Item -ItemType Directory -Force -Path (Join-Path $Sdk 'cmdline-tools') | Out-Null
  Move-Item (Join-Path $tmp 'cmdline-tools') (Join-Path $Sdk 'cmdline-tools\latest')
  Remove-Item -Recurse -Force $tmp, $zip
  $sdkmanager = Find-SdkManager
}
Write-Host "sdkmanager: $sdkmanager"
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:PATH = "$(Split-Path $sdkmanager);$Sdk\platform-tools;$env:PATH"

Step 3 'SDK licences and platform-tools'
$adb = Join-Path $Sdk 'platform-tools\adb.exe'
$licensed = (Get-ChildItem (Join-Path $Sdk 'licenses') -File -ErrorAction SilentlyContinue).Count -gt 0
if ($licensed -and (Test-Path $adb)) {
  Write-Host 'already set up (licences accepted, platform-tools present)'
} else {
  1..60 | ForEach-Object { 'y' } | & $sdkmanager --licenses | Out-Null
  Run $sdkmanager @('platform-tools')
}

$env:EXPO_PUBLIC_API_URL = $ApiUrl
$env:EAS_NO_VCS = '1'
Write-Host "Project: $Root"
Write-Host "API: $ApiUrl"
$signed = Test-Path (Join-Path $App 'credentials\keystore.properties')
if ($signed) { Write-Host 'Signing: release keystore (app\credentials)' -ForegroundColor Green }
else { Write-Host 'Signing: DEBUG key (no app\credentials\keystore.properties): installable, but cannot upgrade a release-signed install' -ForegroundColor Yellow }

function Get-Fingerprint([string[]]$paths, [string]$extra) {
  $sha = [Security.Cryptography.SHA256]::Create()
  $buf = New-Object IO.MemoryStream
  foreach ($p in $paths) {
    foreach ($f in (Get-ChildItem -Path $p -File -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName)) {
      $bytes = [IO.File]::ReadAllBytes($f.FullName)
      if ($f.Name -eq 'app.json') { $bytes = [Text.Encoding]::UTF8.GetBytes(([Text.Encoding]::UTF8.GetString($bytes) -replace '"versionCode":\s*\d+', '"versionCode": 0')) }
      $buf.Write($bytes, 0, $bytes.Length)
    }
  }
  $e = [Text.Encoding]::UTF8.GetBytes($extra)
  $buf.Write($e, 0, $e.Length)
  ([BitConverter]::ToString($sha.ComputeHash($buf.ToArray())) -replace '-', '').ToLower()
}

$abis = if ($AllAbis) { 'armeabi-v7a,arm64-v8a' } else { 'arm64-v8a' }
Write-Host "CPU types: $abis$(if (-not $AllAbis) { '   (add -AllAbis for old 32-bit phones)' })"

Step 4 'dependencies'
Set-Location $Root
$installStamp = Join-Path $Root 'node_modules\.tz-install'
$installPrint = Get-Fingerprint @((Join-Path $Root 'pnpm-lock.yaml'), (Join-Path $Root 'package.json'), (Join-Path $App 'scripts\fix-native-modules.mjs'), (Join-Path $App 'package.json')) ''
if ($Clean -or -not (Test-Path $installStamp) -or ((Get-Content $installStamp -Raw).Trim() -ne $installPrint)) {
  Run 'pnpm' @('install', '--frozen-lockfile', '--config.confirmModulesPurge=false')
  Set-Content -Path $installStamp -Value $installPrint -NoNewline
} else {
  Write-Host 'unchanged since the last build; skipping pnpm install'
}

Step 5 'build shared packages'
Run 'pnpm' @('build')

Step 6 'versionCode and native project'
Set-Location $App
$appJson = Join-Path $App 'app.json'
$text = [IO.File]::ReadAllText($appJson)
if ($text -notmatch '"versionCode":\s*(\d+)') { Fail 'no expo.android.versionCode in app/app.json' }
$was = [int]$Matches[1]
$next = $was + 1
[IO.File]::WriteAllText($appJson, ($text -replace '"versionCode":\s*\d+', ('"versionCode": ' + $next)), (New-Object Text.UTF8Encoding $false))
Write-Host "versionCode $was -> $next (commit app/app.json after a build you ship)"
$env:NODE_ENV = 'production'
$gradleFile = Join-Path $App 'android\app\build.gradle'
$prebuildStamp = Join-Path $App 'android\.tz-prebuild'
$nativePrint = Get-Fingerprint @($appJson, (Join-Path $App 'package.json'), (Join-Path $App 'plugins'), (Join-Path $App 'assets\icon.png'), (Join-Path $App 'assets\adaptive-icon.png'), (Join-Path $App 'assets\adaptive-background.png'), (Join-Path $App 'assets\splash-icon.png'), (Join-Path $Root 'pnpm-lock.yaml'), (Join-Path $App 'scripts\fix-native-modules.mjs')) "signed=$signed"
$fresh = $Clean -or -not (Test-Path $gradleFile) -or -not (Test-Path $prebuildStamp) -or ((Get-Content $prebuildStamp -Raw).Trim() -ne $nativePrint)
if ($fresh) {
  Write-Host 'native config changed (or -Clean): regenerating android\'
  Run 'npx' @('expo', 'prebuild', '--platform', 'android', '--clean', '--no-install')
  Set-Content -Path $prebuildStamp -Value $nativePrint -NoNewline
} else {
  Write-Host 'native config unchanged: keeping android\ for an incremental build'
  $g = [IO.File]::ReadAllText($gradleFile)
  [IO.File]::WriteAllText($gradleFile, ($g -replace 'versionCode(\s*=?\s*)\d+', ('versionCode${1}' + $next)), (New-Object Text.UTF8Encoding $false))
}
if (-not (Test-Path $gradleFile)) { Fail 'prebuild did not produce android\app\build.gradle' }
if ($signed -and -not (Select-String -Path $gradleFile -Pattern 'tzKeystoreProps' -Quiet)) {
  Fail 'the release-signing plugin did not apply (no tzKeystoreProps in build.gradle); refusing to build a debug-signed release'
}

Step 7 "gradle assembleRelease ($(if ($fresh) { 'full build: 10-25 minutes' } else { 'incremental: usually a few minutes' }))"
Set-Location (Join-Path $App 'android')
Run '.\gradlew.bat' @('assembleRelease', "-PreactNativeArchitectures=$abis", '--build-cache')

Step 8 'collect and verify the APK'
$apk = Get-ChildItem (Join-Path $App 'android\app\build\outputs\apk\release') -Filter '*.apk' | Select-Object -First 1
if (-not $apk) { Fail 'no APK was produced' }
$version = (Get-Content (Join-Path $App 'app.json') -Raw | ConvertFrom-Json).expo.version
$target = Join-Path $Out "TashZone-$version-$next$(if ($AllAbis) { '' } else { '-arm64' })-release.apk"
Copy-Item $apk.FullName $target -Force
$buildTools = Get-ChildItem (Join-Path $Sdk 'build-tools') -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
$aapt2 = if ($buildTools) { Join-Path $buildTools.FullName 'aapt2.exe' }
if ($aapt2 -and (Test-Path $aapt2)) {
  $perms = & $aapt2 dump permissions $target 2>$null | Select-String -Pattern "uses-permission.*name='([^']+)'" | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique
  Write-Host ("permissions: " + ($perms -join ', '))
  $banned = @('android.permission.RECORD_AUDIO', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.READ_CONTACTS', 'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE')
  $leaked = $perms | Where-Object { $banned -contains $_ }
  if ($leaked) { Fail ("the APK requests blocked permissions: " + ($leaked -join ', ') + ". A dependency added them; block them in app.json android.blockedPermissions.") }
}
$apksigner = Get-ChildItem (Join-Path $Sdk 'build-tools') -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'apksigner.bat' } | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($apksigner) { & $apksigner verify --print-certs $target }
Write-Host ""
Write-Host ("DONE: {0} ({1:N1} MB)" -f $target, ((Get-Item $target).Length / 1MB)) -ForegroundColor Green

if ($Install) {
  Step 9 'install on the connected phone'
  Run 'adb' @('install', '-r', $target)
} else {
  Write-Host "Install on a phone:  adb install -r `"$target`""
}
Stop-Transcript | Out-Null
