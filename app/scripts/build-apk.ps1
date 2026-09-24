param(
  [switch]$Install,
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
$sdkmanager = Join-Path $Sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path $sdkmanager)) {
  $zip = Join-Path $Toolchain 'cmdline-tools.zip'
  Write-Host 'downloading command-line tools (~150 MB)'
  Invoke-WebRequest -Uri $CmdlineToolsUrl -OutFile $zip
  $tmp = Join-Path $Toolchain 'cmdline-tmp'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp
  New-Item -ItemType Directory -Force -Path (Join-Path $Sdk 'cmdline-tools') | Out-Null
  Move-Item (Join-Path $tmp 'cmdline-tools') (Join-Path $Sdk 'cmdline-tools\latest')
  Remove-Item -Recurse -Force $tmp, $zip
}
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:PATH = "$Sdk\cmdline-tools\latest\bin;$Sdk\platform-tools;$env:PATH"

Step 3 'SDK licences, platform-tools and current command-line tools'
1..60 | ForEach-Object { 'y' } | & $sdkmanager --licenses | Out-Null
$props = Join-Path $Sdk 'cmdline-tools\latest\source.properties'
$rev = if (Test-Path $props) { [double]((Select-String -Path $props -Pattern '^Pkg\.Revision=(\d+(\.\d+)?)').Matches[0].Groups[1].Value) } else { 0 }
if ($rev -lt 16) {
  Write-Host "updating command-line tools $rev to the latest"
  Run $sdkmanager @('cmdline-tools;latest')
  $fresh = Join-Path $Sdk 'cmdline-tools\latest-2'
  if (Test-Path $fresh) {
    $old = Join-Path $Sdk 'cmdline-tools\previous'
    if (Test-Path $old) { Remove-Item -Recurse -Force $old }
    Move-Item (Join-Path $Sdk 'cmdline-tools\latest') $old
    Move-Item $fresh (Join-Path $Sdk 'cmdline-tools\latest')
  }
}
Run $sdkmanager @('platform-tools')

$env:EXPO_PUBLIC_API_URL = $ApiUrl
$env:EAS_NO_VCS = '1'
Write-Host "Project: $Root"
Write-Host "API: $ApiUrl"
$signed = Test-Path (Join-Path $App 'credentials\keystore.properties')
if ($signed) { Write-Host 'Signing: release keystore (app\credentials)' -ForegroundColor Green }
else { Write-Host 'Signing: DEBUG key (no app\credentials\keystore.properties): installable, but cannot upgrade a release-signed install' -ForegroundColor Yellow }

Step 4 'pnpm install'
Set-Location $Root
Run 'pnpm' @('install', '--frozen-lockfile', '--config.confirmModulesPurge=false')

Step 5 'build shared packages'
Run 'pnpm' @('build')

Step 6 'raise versionCode, then expo prebuild (android)'
Set-Location $App
$appJson = Join-Path $App 'app.json'
$text = [IO.File]::ReadAllText($appJson)
if ($text -notmatch '"versionCode":\s*(\d+)') { Fail 'no expo.android.versionCode in app/app.json' }
$was = [int]$Matches[1]
$next = $was + 1
[IO.File]::WriteAllText($appJson, ($text -replace '"versionCode":\s*\d+', ('"versionCode": ' + $next)), (New-Object Text.UTF8Encoding $false))
Write-Host "versionCode $was -> $next (commit app/app.json after a build you ship)"
$env:NODE_ENV = 'production'
Run 'npx' @('expo', 'prebuild', '--platform', 'android', '--clean', '--no-install')
$gradleFile = Join-Path $App 'android\app\build.gradle'
if (-not (Test-Path $gradleFile)) { Fail 'prebuild did not produce android\app\build.gradle' }
if ($signed -and -not (Select-String -Path $gradleFile -Pattern 'tzKeystoreProps' -Quiet)) {
  Fail 'the release-signing plugin did not apply (no tzKeystoreProps in build.gradle); refusing to build a debug-signed release'
}

Step 7 'gradle assembleRelease (10-25 minutes the first time)'
Set-Location (Join-Path $App 'android')
Run '.\gradlew.bat' @('assembleRelease')

Step 8 'collect and verify the APK'
$apk = Get-ChildItem (Join-Path $App 'android\app\build\outputs\apk\release') -Filter '*.apk' | Select-Object -First 1
if (-not $apk) { Fail 'no APK was produced' }
$version = (Get-Content (Join-Path $App 'app.json') -Raw | ConvertFrom-Json).expo.version
$target = Join-Path $Out "TashZone-$version-release.apk"
Copy-Item $apk.FullName $target -Force
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
