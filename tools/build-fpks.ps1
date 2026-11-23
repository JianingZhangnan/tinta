param(
    [string]$WebView2Sdk = 'D:\Program Files\WebView2-SDK\1.0.4370.26',
    [string]$Md4cSource = 'D:\Program Files\_cache\Tinta\md4c-0.5.2',
    [string]$BuildDirectory = '',
    [switch]$SkipWebInstall,
    [switch]$Verify
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not $BuildDirectory) { $BuildDirectory = Join-Path $root 'build-fpks' }
if (-not (Test-Path -LiteralPath (Join-Path $WebView2Sdk 'build\native\include\WebView2.h'))) {
    throw 'Pass -WebView2Sdk with the unpacked Microsoft.Web.WebView2 1.0.4370.26 NuGet package.'
}
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$visualStudio = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $visualStudio) { throw 'Visual Studio C++ build tools are required.' }
$dev = Join-Path $visualStudio 'Common7\Tools\VsDevCmd.bat'
$cmake = Join-Path $visualStudio 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
$ctest = Join-Path (Split-Path $cmake) 'ctest.exe'
Push-Location (Join-Path $root 'web')
try {
    if (-not $SkipWebInstall) { & npm.cmd ci; if ($LASTEXITCODE) { throw 'npm ci failed.' } }
    & node.exe build.mjs
    if ($LASTEXITCODE) { throw 'Web bundle build failed.' }
} finally { Pop-Location }
$configure = '"{0}" -arch=x64 -host_arch=x64 >nul && "{1}" -S "{2}" -B "{3}" -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON "-DTINTA_WEBVIEW2_SDK={4}"' -f $dev,$cmake,$root,$BuildDirectory,$WebView2Sdk
if (Test-Path -LiteralPath (Join-Path $Md4cSource 'src\md4c.c')) { $configure += ' "-DFETCHCONTENT_SOURCE_DIR_MD4C={0}"' -f $Md4cSource }
& cmd.exe /d /s /c $configure
if ($LASTEXITCODE) { throw 'CMake configure failed.' }
$targets = if ($Verify) { 'tinta input_tests math_parser_tests math_layout_tests edit_delta_tests' } else { 'tinta' }
$compile = '"{0}" -arch=x64 -host_arch=x64 >nul && "{1}" --build "{2}" --target {3} -j 8' -f $dev,$cmake,$BuildDirectory,$targets
& cmd.exe /d /s /c $compile
if ($LASTEXITCODE) { throw 'Native build failed.' }
if ($Verify) {
    & $ctest --test-dir $BuildDirectory -R 'fpks_edit_delta|performance_regressions|input_shortcuts|math_markdown|math_parser|math_layout' --output-on-failure
    if ($LASTEXITCODE) { throw 'Native regression tests failed.' }
    Push-Location (Join-Path $root 'web')
    try { & node.exe tests/regression.mjs; if ($LASTEXITCODE) { throw 'Browser regression tests failed.' } } finally { Pop-Location }
}
Write-Output "Built: $BuildDirectory\tinta.exe"
