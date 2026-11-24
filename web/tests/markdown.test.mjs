import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {renderMarkdown} from '../src/markdown.js';

const fixture=await fs.readFile(new URL('../../tests/fixtures/fpks-callout-math.md',import.meta.url),'utf8');
test('FPKS density formulas exclude callout markers and preserve mixed content',()=>{
 const result=renderMarkdown(fixture),display=result.equations.filter(e=>e.display).map(e=>e.tex.trim());
 assert.deepEqual(display,[
  String.raw`E=pc=\hbar ck.`,
  String.raw`g(k)\,dk=\dfrac{g_{\rm spin}Vk^2}{2\pi^2}\,dk`,
  String.raw`g(E)\,dE
=\dfrac{g_{\rm spin}V}{2\pi^2(\hbar c)^3}E^2\,dE.`,
  String.raw`\begin{aligned}
x &> 0\\
y &\ge 1
\end{aligned}`,
  'a>b',
  String.raw`p>q\quad\text{且}\quad r<s`,
 ]);
 assert.match(result.html,/<blockquote>/);assert.match(result.html,/<table>/);
 assert.match(result.html,/<li>\s*<p>列表后续项目保持正常/);assert.match(result.html,/<strong>加粗<\/strong>/);
 assert.match(result.html,/&gt; \$\$/);assert.match(result.html,/<p>最后一个普通段落。<\/p>/);
});
test('math extraction preserves intentional greater-than symbols',()=>{
 assert.equal(renderMarkdown('> $$\n> x > y\\quad z\\ge 0\n> $$').equations[0].tex.trim(),String.raw`x > y\quad z\ge 0`);
 assert.equal(renderMarkdown('$$\n> x\n$$').equations[0].tex.trim(),'> x');
});
test('an unclosed equation stays within its quote or list item',()=>{
 for(const text of ['> $$\n> unclosed\n\n$$outside$$','- $$\n  unclosed\n\n$$outside$$']){
  const result=renderMarkdown(text);
  assert.deepEqual(result.equations.map(e=>e.tex.trim()),['outside']);
  assert.match(result.html,/unclosed/);
 }
});
test('quoted delimiters with CRLF, tabs and escaped dollars',()=>{
 assert.equal(renderMarkdown('>\t$$\r\n>\tx>y\r\n>\t$$').equations[0].tex.trim(),'x>y');
 assert.equal(renderMarkdown(String.raw`> $$
> \text{cost: \$$} > 1
> $$`).equations[0].tex.trim(),String.raw`\text{cost: \$$} > 1`);
});
test('indented and fenced code stay literal',()=>{
 assert.deepEqual(renderMarkdown('    $$x>y$$\n\n```latex\n> $$x>y$$\n```').equations,[]);
});
