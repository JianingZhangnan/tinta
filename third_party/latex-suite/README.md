# LaTeX Suite provenance

Source: https://github.com/artisticat1/obsidian-latex-suite, tag `1.12.8`,
archive revision beginning `f0e5a02`. The upstream MIT license is included.

The source and stylesheet are vendored so the same editor implementation as
FPKS can be bundled without requiring Obsidian. `web/src/obsidian.ts` provides
the small host API used by these modules. The only adaptation in Suite source
is `src/utils/context.ts`: recognize standalone Lezer Markdown code nodes in
addition to Obsidian's HyperMD nodes. This preserves code-block exclusions and
the `forceMathLanguages` behavior.

`web/build.mjs` generates `latex-parser.js` and `latex-parser.terms.js` from the
upstream grammar using the locked Lezer generator. User snippets and private
vault settings are loaded from the local FPKS profile and are not vendored.
