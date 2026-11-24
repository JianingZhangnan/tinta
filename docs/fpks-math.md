# FPKS math edition

This optional Windows build keeps Tinta's native reading path for Markdown
without equations and for plain text. Markdown containing actual math nodes,
or entering Markdown edit mode, starts an offline WebView2 panel. It uses the
FPKS vault's production MathJax 4.1.3 renderer and LaTeX Suite 1.12.8.

## Local profile

Run `tools/prepare-fpks.ps1 -Vault <FPKS-path>`. It copies only the math runtime,
fonts, math styles, Suite settings and shared snippet source into
`%APPDATA%\Tinta\fpks-profile`. `source.json` records local origins and
`fingerprints.json` records SHA-256 hashes. These files stay outside Git.

The profile preserves Pagella and the exact selected NewCM, Asana, Latin
Modern, Termes and STIX glyph patches; MathJax scale 1.15; display-style inline
and nested fractions; display-style cases with .4em row spacing; script-comma
spacing; the current Pagella calligraphic alphabet; and the FPKS baseline and
overflow rules. The full unrelated Obsidian theme, including embedded CJK
fonts, is omitted. Math-specific theme rules are extracted from the source.

Suite reads all 245 current shared snippets and the actual FPKS settings.
Snippets are refreshed from the original shared maintenance file on mtime
changes every two seconds; editing the profile copy is temporary. Re-run the
profile preparation script after changing renderer, font or Suite settings.
The original vault is not modified by profile preparation.

## Build and use

Dependencies: Visual Studio 2022 C++/Windows SDK/CMake/Ninja, Node 24,
Microsoft.Web.WebView2 SDK 1.0.4370.26 (unpack its NuGet package), and the
installed Evergreen WebView2 runtime. MD4C is pinned to
`729e6b8b320caa96328968ab27d7db2235e4fb47` (0.5.2); a local source cache can
be supplied to avoid fetching it during configure.

```powershell
./tools/prepare-fpks.ps1
./tools/build-fpks.ps1 -Verify
```

SDK and dependency-cache defaults follow this machine's D-drive layout;
override `-WebView2Sdk`, `-Md4cSource` and `-BuildDirectory` elsewhere.
The ordinary upstream build still works without `TINTA_WEBVIEW2_SDK` and
compiles a no-op FPKS integration. Run browser tests with `cd web; npm test`;
they use installed Chrome and the local FPKS profile.

Deploy `tinta.exe`, `WebView2Loader.dll` and the built `fpks` directory beside
one another. Keep the local profile in AppData. Generated WebView2 cache goes
to `D:\Program Files\_cache\Tinta\WebView2` for this machine's install path;
`TINTA_FPKS_CACHE` overrides it. Retain the original executable for rollback
and disable upstream automatic updates for this custom build.

Reading: press E or double-click the preview to edit. The toolbar switches
between reading, source and split view. Ctrl+S saves, Ctrl+Shift+S saves as,
Ctrl+O opens a file and Ctrl+Shift+E returns to reading. FPKS snippets, Tab and
Shift+Tab placeholders, matrix Enter/Tab, automatic fractions, bracket
enlargement, tabout, paired-dollar deletion and equation tooltips use Suite's
own implementation. Paste converts `\(...\)` and `\[...\]` as configured in
FPKS. Native Mermaid rendering is reused through an SVG bridge.

The math toolbar's **Print / PDF** action typesets all equations and prints
the FPKS view, including formulas outside the current viewport. The original
native Export as HTML/DOCX/PDF and native print preview retain the upstream
math engine; they are not the FPKS export path. Obsidian-specific vault
features, plugins, embeds, callouts and wikilinks are outside this math port.

## Data and performance

Native/browser edits cross the bridge as atomic UTF-16 transactions, preserving
Chinese and emoji offsets. Full documents are sent on document changes,
not every keypress. Native line indices are rebuilt only for native actions.
CodeMirror keeps its rope structure; the preview serializes after a pause.
Markdown over 256 KiB is parsed in a worker, with one active and one latest
queued job. Unchanged top-level blocks retain their rendered math. The formula
cache is limited to 256 entries and a 4 MiB serialized-size estimate (not an
exact heap limit). Formulas are typeset near the viewport. Hidden web panels
are suspended; they resume when shown.

Plain-text documents at least 8 MiB open directly in the native source view,
render visible lines and defer preview, syntax highlighting, wrapping and
whole-document word counts. Normal saved preferences are preserved. This is
not a memory-mapped editor: the complete file still occupies source buffers.

Measured here on 2026-11-23 with fresh processes and warm OS/file caches:

| Case | Observed first content | Private committed memory |
| --- | --- | --- |
| Small plain Markdown | native EndDraw 53–56 ms | about 82 MiB, one process |
| FPKS math fixture | first formula DOM/animation-frame event 2.53–2.56 s | about 333 MiB across the process tree |
| 90 MiB text | native EndDraw about 0.8 s; end-of-file navigation checked | about 450–550 MiB depending on sampling |

Math-mode working-set sums were about 514 MiB; summing process working sets
can count shared pages more than once. `WaitForInputIdle` only measures the
shell becoming responsive and is not a rendering-complete measurement.
`tools/benchmark_fpks.py` records both that metric and the fork's first-frame
events. The math bridge and exact renderer have a substantial runtime cost
relative to upstream's limited native math; the original tiny-memory goal is
not achieved in FPKS math mode.

## Validation and notices

Automated coverage includes native input/performance/math groups, UTF-16
delta validation, 245-snippet loading, representative automatic/regex/function
snippets, linked placeholders, reverse tabstops, matrix keys, tabout, paired
dollar deletion, code exclusions, forced-math fences, bracket enlargement,
paste conversion, undo across snippet refresh, worker parsing, all 23 FPKS
font reference cases, narrow overflow, dark math, printing and cache limits.
Actual Tinta windows were also exercised using the computer-use skill.

Callout display math reads Markdown's logical lines after quote/list markers
have been removed. Literal TeX comparison operators remain intact. The
`fpks-callout-math.md` fixture covers the density equations, multiline TeX,
nested quotes, list containers, ordinary surrounding Markdown and code.
Five parser checks and a browser regression cover these cases, including
normal/narrow widths, dark/light display and PDF output. The installed app
was checked with computer use against the original FPKS note without edits.

The production profile retains MathJax/font third-party notices and their
source manifest. Suite's MIT license is in `third_party/latex-suite`.
Node dependency notices can be rebuilt from the locked package metadata.
The local math host suppresses disabled speech-worker actions; it does not
change the production renderer's visible glyphs or math metrics.
