param(
    [string]$Vault = 'D:\BaiduSyncdisk\FPKS',
    [string]$Destination = "$env:APPDATA\Tinta\fpks-profile"
)
$ErrorActionPreference = 'Stop'
$obsidian = Join-Path $Vault '.obsidian'
$renderer = Join-Path $obsidian 'plugins\mathjax4-pagella'
if (-not (Test-Path -LiteralPath (Join-Path $renderer 'vendor'))) { throw 'FPKS math renderer was not found.' }
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
function Write-Utf8([string]$Name, [string]$Text) {
    [System.IO.File]::WriteAllText((Join-Path $Destination $Name), $Text, [System.Text.UTF8Encoding]::new($false))
}
Copy-Item -LiteralPath (Join-Path $renderer 'vendor') -Destination $Destination -Recurse -Force
foreach ($name in @('main.js','font-sources.json','THIRD_PARTY_NOTICES.md')) {
    Copy-Item -LiteralPath (Join-Path $renderer $name) -Destination (Join-Path $Destination $name) -Force
}
Copy-Item -LiteralPath (Join-Path $obsidian 'plugins\auto-displaystyle-v2\main.js') -Destination (Join-Path $Destination 'auto-displaystyle.js') -Force
Copy-Item -LiteralPath (Join-Path $obsidian 'appearance.json') -Destination $Destination -Force
foreach ($name in @('inline-math-zoom.css','block-math-zoom.css')) {
    Copy-Item -LiteralPath (Join-Path $obsidian "snippets\$name") -Destination $Destination -Force
}
# Only math rules are needed. The complete theme embeds ~10 MB of unrelated
# CJK fonts, which would duplicate resources and override Tinta's interface.
$theme = Get-Content -LiteralPath (Join-Path $obsidian 'themes\Claude Warm\theme.css') -Raw
$theme = [regex]::Replace($theme, '(?s)/\*.*?\*/', '')
$mathRules = [regex]::Matches($theme, '(?s)([^{}]+)\{([^{}]*)\}') | Where-Object { $_.Groups[1].Value -match 'math|mjx|MathJax|katex' }
$mathCss = ".theme-dark{--cw-math-color:#ffffff}.theme-light{--cw-math-color:var(--ink)}" + [string]::Join("`n", @($mathRules | ForEach-Object { $_.Value }))
Write-Utf8 'math-theme.css' $mathCss
$legacyTheme = Join-Path $Destination 'theme.css'
if ((Test-Path -LiteralPath $legacyTheme) -and ((Get-FileHash -LiteralPath $legacyTheme).Hash -eq (Get-FileHash -LiteralPath (Join-Path $obsidian 'themes\Claude Warm\theme.css')).Hash)) {
    Remove-Item -LiteralPath $legacyTheme
}
Copy-Item -LiteralPath (Join-Path $obsidian 'plugins\obsidian-latex-suite\styles.css') -Destination (Join-Path $Destination 'suite.css') -Force
$snippetsPath = Join-Path $obsidian 'latex-suite\snippets.js'
$settingsPath = Join-Path $obsidian 'plugins\obsidian-latex-suite\data.json'
Copy-Item -LiteralPath $snippetsPath -Destination (Join-Path $Destination 'snippets.js') -Force
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$settings.PSObject.Properties.Remove('snippets')
$pasteSettings = Join-Path $obsidian 'plugins\convert-katex-to-mathjax\data.json'
$pasteEnabled = $true
if (Test-Path -LiteralPath $pasteSettings) { $pasteEnabled = (Get-Content -LiteralPath $pasteSettings -Raw | ConvertFrom-Json).enableDefaultPasteConversion }
$settings | Add-Member -NotePropertyName pasteMathConversion -NotePropertyValue $pasteEnabled -Force
Write-Utf8 'suite-settings.json' ($settings | ConvertTo-Json -Depth 12)
Write-Utf8 'source.json' (@{ snippets = $snippetsPath; settings = $settingsPath; renderer = $renderer; vault = $Vault } | ConvertTo-Json)
$fingerprints = Get-ChildItem -LiteralPath $Destination -File -Recurse | Where-Object { $_.Name -ne 'fingerprints.json' } |
    ForEach-Object { @{ path = $_.FullName.Substring($Destination.Length + 1); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } }
Write-Utf8 'fingerprints.json' ($fingerprints | ConvertTo-Json -Depth 4)
Write-Output "Prepared FPKS math profile: $Destination"
