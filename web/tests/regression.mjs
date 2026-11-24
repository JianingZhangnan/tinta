import {chromium} from '@playwright/test';
import {server} from './server.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const srv=server();await new Promise(r=>srv.listen(18734,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],checks=[];
await page.addInitScript(()=>{window.fpksMessages=[];(window.chrome??={}).webview={postMessage:m=>window.fpksMessages.push(m),addEventListener(){}}});
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const report=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name)};
const docText=()=>page.locator('.cm-content').innerText();
async function load(text,edit=true){await page.evaluate(({text,edit})=>window.fpksReceive({type:'document',session:Math.random().toString(),path:'regression.md',text,edit}),{text,edit});if(edit){await page.waitForSelector('.cm-content');await page.locator('.cm-content').click();await page.keyboard.press('Control+End')}await page.waitForTimeout(60)}
async function type(text){await page.keyboard.type(text,{delay:8})}
try{
 await page.goto('http://127.0.0.1:18734/');await page.waitForFunction(()=>window.fpksDiagnostics?.().version==='4.1.3');
 await report('all shared snippets parsed',async()=>{await load('');assert.equal((await page.evaluate(()=>fpksDiagnostics())).snippets,245)});
 await report('inline trigger and mirrored derivative placeholders',async()=>{await load('');await type('mkddnt');await type('3');assert.match(await docText(),/\\mathrm\{d\}\^\{3\}.*t\^\{3\}/);await page.keyboard.press('Tab');await type('x');assert.match(await docText(),/x\$$/)});
 await report('display trigger and Greek automatic expansion',async()=>{await load('');await type('dm@a');assert.match(await docText(),/\$\$[\s\S]*\\alpha[\s\S]*\$\$/)});
 await report('fraction tabstops and reverse navigation',async()=>{await load('');await type('mk');await type('//');await type('x');await page.keyboard.press('Tab');await type('y');await page.keyboard.press('Shift+Tab');await type('a');assert.match(await docText(),/\\dfrac\{a\}\{y\}/)});
 await report('automatic fractions',async()=>{await load('');await type('mk');await type('x/');assert.match(await docText(),/\\dfrac\{x\}\{\}/)});
 await report('regex letter subscripts',async()=>{await load('');await type('mk');await type('a2');assert.match(await docText(),/a_\{2\}/)});
 await report('function snippet identity matrix',async()=>{await load('');await type('mk');await type('iden3');assert.match(await docText(),/1 & 0 & 0[\s\S]*0 & 1 & 0[\s\S]*0 & 0 & 1/)});
 await report('matrix Tab and Enter',async()=>{await load('$\\begin{pmatrix}\\end{pmatrix}$');await page.keyboard.press('Control+Home');for(let n=0;n<16;n++)await page.keyboard.press('ArrowRight');await type('a');await page.keyboard.press('Tab');await type('b');await page.keyboard.press('Enter');await type('c');assert.match(await docText(),/a & b[\s\S]*\\\\[\s\S]*c/)});
 await report('code context suppresses math snippets',async()=>{await load('```js\n\n```');await page.keyboard.press('Control+Home');await page.keyboard.press('ArrowDown');await type('mkddnt');assert.match(await docText(),/mkddnt/);assert.doesNotMatch(await docText(),/\\dfrac/)});
 await report('math fences use FPKS force-math language setting',async()=>{await load('```math\n\n```');await page.keyboard.press('Control+Home');await page.keyboard.press('ArrowDown');await type('@a');assert.match(await docText(),/\\alpha/)});
 await report('Tab exits an equation and Backspace removes paired dollars',async()=>{await load('$x$');await page.keyboard.press('ArrowLeft');await page.keyboard.press('Tab');await type('OK');assert.equal(await docText(),'$x$OK');await load('');await type('mk');await page.keyboard.press('Backspace');assert.equal((await page.evaluate(()=>fpksDiagnostics())).docLength,0)});
 await report('fraction brackets automatically enlarge',async()=>{await load('$()$');await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');await type('//');assert.match(await docText(),/\\left\(/);assert.match(await docText(),/\\right\)/)});
 await report('undo and redo retain snippet operations',async()=>{await load('');await type('mkddnt');const before=await docText();await page.keyboard.press('Control+z');await page.keyboard.press('Control+y');assert.equal(await docText(),before)});
 await report('UTF-16 edit transactions roundtrip and one save per Ctrl+S',async()=>{
  const initial='中文 😀 ';
  await load(initial);await page.evaluate(()=>fpksMessages.length=0);await type('mkddnt3');await page.keyboard.press('Tab');await page.keyboard.press('Control+s');
  const messages=await page.evaluate(()=>fpksMessages);let restored=initial;
  for(const m of messages.filter(m=>m.type==='changes'))for(const c of [...m.changes].reverse())restored=restored.slice(0,c.from)+c.insert+restored.slice(c.to);
  assert.equal(restored,await docText());assert.equal(messages.filter(m=>m.type==='save').length,1);
 });
 await report('FPKS paste conversion preserves Unicode and math delimiters',async()=>{
  await load('');await page.locator('.cm-content').evaluate(e=>{const dt=new DataTransfer();dt.setData('text/plain','中文 😀 \\(x+1\\)\n\\[\\frac{a}{b}\\]');e.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:dt}))});
  assert.match(await docText(),/中文 😀 \$x\+1\$/);assert.match(await docText(),/\$\$\n\\frac\{a\}\{b\}\n\$\$/);
 });
 await report('snippet refresh keeps edits and undo history',async()=>{
  await load('');await type('mkx');const before=await docText();
  const original=await fs.readFile(path.join(process.env.APPDATA,'Tinta/fpks-profile/snippets.js'),'utf8');
  await page.route('**/profile/snippets.js',r=>r.fulfill({body:original.replace('const snippets = [',"const snippets = [{trigger:'zzfpks',replacement:'ZFPKS',options:'mA'},"),contentType:'text/javascript'}));
  await page.evaluate(()=>fpksReceive({type:'profileChanged'}));assert.equal(await docText(),before);assert.equal((await page.evaluate(()=>fpksDiagnostics())).snippets,246);
  await type('zzfpks');assert.match(await docText(),/ZFPKS/);await page.keyboard.press('Control+z');assert.doesNotMatch(await docText(),/ZFPKS/);
  await page.unroute('**/profile/snippets.js');await page.evaluate(()=>fpksReceive({type:'profileChanged'}));
 });
 await report('large worker parsing coalesces rapid document changes',async()=>{
  const large='# Worker document\n\n'+('A line of **Markdown** text.\n\n'.repeat(12000));
  await page.evaluate(async text=>{await Promise.all([fpksReceive({type:'document',session:'worker-a',text:text+'\n$A$',edit:false}),fpksReceive({type:'document',session:'worker-b',text:text+'\n$B$',edit:false}),fpksReceive({type:'document',session:'worker-c',text:text+'\n$C$',edit:false})])},large);
  await page.waitForFunction(()=>document.querySelector('#preview h1')?.textContent==='Worker document');
  assert.equal((await page.evaluate(()=>fpksDiagnostics())).session,'worker-c');
  assert.equal(await page.locator('#preview strong').count(),12000);
  const last=await page.locator('[data-equation]').last().evaluate(e=>e.outerHTML);assert.ok(last.includes('data-equation'));
 });
 const cases=JSON.parse(await fs.readFile('C:/Users/Zhang/AppData/Roaming/Tinta/fpks-profile/source.json','utf8'));
 const glyphCases=JSON.parse(await fs.readFile(path.join(cases.renderer,'scripts/ladr-cases.json'),'utf8'));
 await report('23 FPKS formula cases, font families and typography',async()=>{
  await load(glyphCases.map(c=>'## '+c.id+'\n\n$$\n'+c.tex+'\n$$').join('\n\n'),false);
  for(let i=0;i<18;i++){await page.locator('#preview').evaluate(e=>e.scrollTop+=600);await page.waitForTimeout(40)}
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-equation]')].every(e=>e.dataset.done));
  assert.equal(await page.locator('mjx-merror').count(),0);
  assert.equal(await page.locator('[data-equation]').count(),glyphCases.length);
  const glyphs=await page.evaluate(()=>({newcm:document.querySelectorAll('mjx-c.NCM-N').length,asana:document.querySelectorAll('mjx-c.ASNA-N').length,modern:document.querySelectorAll('mjx-c.MM-N').length,pagella:document.querySelectorAll('mjx-c.GP-C').length,termes:document.querySelectorAll('mjx-c.GT-N').length,stix:document.querySelectorAll('mjx-c.STX-N').length,scale:MathJax.startup.document.outputJax.options.scale,cases:MathJax.startup.document.inputJax.find(i=>i.name==='TeX').parseOptions.handlers.get('environment').lookup('cases').args.slice(-2)}));
  for(const name of ['newcm','asana','modern','pagella','termes','stix'])assert.ok(glyphs[name]>0,name);
  assert.equal(glyphs.scale,1.15);assert.deepEqual(glyphs.cases,['.4em','D']);
 });
 await report('narrow viewport keeps long math scrollable',async()=>{await page.setViewportSize({width:620,height:800});await load('$$\n'+glyphCases.at(-1).tex+'\n$$',false);await page.waitForSelector('mjx-container');assert.ok(await page.locator('.math-block').evaluate(e=>e.scrollWidth>e.clientWidth));await page.screenshot({path:'../build-fpks/narrow-math.png'})});
 await report('dark math and print/PDF retain FPKS typography',async()=>{
  await page.setViewportSize({width:1280,height:900});await load('# Printed math\n\n$\\mathcal{A}+\\vec a$\n\n$$\\dfrac{1}{\\sqrt{x^2+1}}$$',false);
  await page.evaluate(()=>fpksReceive({type:'theme',colors:{page:'#181818',ink:'#eeeeee',muted:'#aaaaaa',accent:'#ff9955',line:'#444444'},fontSize:19}));
  await page.waitForSelector('mjx-container');assert.equal(await page.locator('mjx-container').first().evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
  await page.screenshot({path:'../build-fpks/dark-math.png'});
  await page.evaluate(()=>{window.print=()=>{window.fpksPrinted=true}});await page.locator('#print').click();await page.waitForFunction(()=>window.fpksPrinted);
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('mjx-container').first().evaluate(e=>getComputedStyle(e).color),'rgb(48, 43, 39)');
  await page.pdf({path:'../build-fpks/fpks-print.pdf',format:'A4'});await page.screenshot({path:'../build-fpks/print-math.png'});await page.emulateMedia({media:'screen'});
 });
 await report('callout formulas exclude quote markers at normal/narrow widths and in PDF',async()=>{
  const text=await fs.readFile('../tests/fixtures/fpks-callout-math.md','utf8');
  await load(text,false);await page.locator('#preview').evaluate(e=>e.scrollTop=0);
  await page.waitForFunction(()=>[...document.querySelectorAll('#preview>blockquote:first-of-type .math-block')].every(e=>e.dataset.done));
  const formulaText=()=>page.locator('#preview>blockquote:first-of-type .math-block').allTextContents();
  assert.equal((await formulaText()).length,3);for(const t of await formulaText())assert.doesNotMatch(t,/[<>]/);
  assert.equal(await page.locator('mjx-merror').count(),0);
  await page.screenshot({path:'../build-fpks/callout-dark-normal.png'});
  await page.setViewportSize({width:620,height:900});
  await page.evaluate(()=>fpksReceive({type:'theme',colors:{page:'#faf9f6',ink:'#302b27',muted:'#766f65',accent:'#b75224',line:'#dcd7ce'},fontSize:19}));
  await page.screenshot({path:'../build-fpks/callout-light-narrow.png'});
  await page.locator('#print').click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-equation]')].every(e=>e.dataset.done));
  for(const t of await formulaText())assert.doesNotMatch(t,/[<>]/);
  assert.match((await page.locator('.math-block').allTextContents())[3],/>/);
  await page.pdf({path:'../build-fpks/callout-math.pdf',format:'A4'});
  await page.setViewportSize({width:1280,height:900});
 });
 await report('bounded cache and lazy rendering',async()=>{await load(Array.from({length:700},(_,i)=>`## item ${i}\n\n$x_{${i}}+1$\n`).join('\n'),false);await page.waitForTimeout(200);const d=await page.evaluate(()=>fpksDiagnostics());assert.ok(d.cacheBytes<=4*1024*1024);assert.ok(d.cacheEntries<=256);const rendered=await page.locator('mjx-container').count();assert.ok(rendered>0&&rendered<50)});
 assert.deepEqual(errors,[]);
 await fs.writeFile('../build-fpks/web-regression.json',JSON.stringify({checks,errors,diagnostics:await page.evaluate(()=>fpksDiagnostics())},null,2));
}catch(e){console.error(JSON.stringify({failure:e.message,errors,text:await docText().catch(()=>''),checks}));throw e}finally{await browser.close();srv.close()}
