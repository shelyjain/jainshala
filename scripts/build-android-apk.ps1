# Local debug APK build for Jain Shala (Windows).
# Requires: Android Studio (SDK + JDK bundled as "jbr").

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Find-AndroidStudioJbr {
    $candidates = @(
        "$env:ProgramFiles\Android\Android Studio\jbr",
        "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr",
        "${env:ProgramFiles(x86)}\Android\Android Studio\jbr"
    )
    foreach ($path in $candidates) {
        if (Test-Path (Join-Path $path "bin\java.exe")) { return $path }
    }
    return $null
}

function Find-AndroidSdk {
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { return $env:ANDROID_HOME }
    if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) { return $env:ANDROID_SDK_ROOT }
    $default = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $default) { return $default }
    return $null
}

if (-not $env:JAVA_HOME) {
    $jbr = Find-AndroidStudioJbr
    if ($jbr) {
        $env:JAVA_HOME = $jbr
        $env:Path = "$jbr\bin;$env:Path"
        Write-Host "Using JAVA_HOME: $jbr"
    }
}

if (-not $env:JAVA_HOME -and -not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "ERROR: Java not found." -ForegroundColor Red
    Write-Host "Install Android Studio: https://developer.android.com/studio"
    Write-Host "Then open it once (SDK + JDK install), or set JAVA_HOME to the Studio 'jbr' folder."
    exit 1
}

$sdk = Find-AndroidSdk
if (-not $sdk) {
    Write-Host ""
    Write-Host "ERROR: Android SDK not found." -ForegroundColor Red
    Write-Host "Install Android Studio and open: Settings -> Languages & Frameworks -> Android SDK"
    Write-Host "Default SDK path: $env:LOCALAPPDATA\Android\Sdk"
    Write-Host "Set ANDROID_HOME to that folder, then run this script again."
    exit 1
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
Write-Host "Using ANDROID_HOME: $sdk"

if (-not (Test-Path "android\gradlew.bat")) {
    Write-Host "Generating android/ (expo prebuild)..."
    npx expo prebuild --platform android --no-install
}

Write-Host ""
Write-Host "Building debug APK (this may take several minutes on first run)..."
Set-Location android
& .\gradlew.bat assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $Root "android\app\build\outputs\apk\debug\app-debug.apk"
$dest = Join-Path $Root "jain-shala-debug.apk"
Copy-Item -Force $apk $dest

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host "APK: $dest"
Write-Host "Also at: $apk"
