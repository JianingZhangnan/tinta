import {ensureMath,profileRoot,renderMath,mathCache} from './math.js';
import {renderMarkdown} from './markdown.js';
import DOMPurify from 'dompurify';
import {ScrollSync} from './scroll-sync.js';
const started=performance.now(),bridge=window.chrome?.webview;
const post=message=>bridge?.postMessage(message);
const status=document.querySelector('#status'),main=document.querySelector('main'),preview=document.querySelector('#preview');
let session='',source='',path='',mode='read',editor,editorModule,settings,snippets,mathReady=false,generation=0,previewTimer,observer,applying=false,dirty=false,sourceStale=false;
let editorPreparing,editorResources,firstMathPaint=false,editSession=false;
const scrollSync=new ScrollSync(preview,()=>editor,()=>mode);
const blockSources=new WeakMap();
const metrics={readyMs:0,mathReadyMs:0,lastPreviewMs:0,previewJobs:0,equationsRendered:0};
let parserWorker,workerId=0,workerActive,workerQueued;
function startParse(job){workerActive=job;parserWorker.postMessage({id:job.id,source:job.text})}
async function parsePreview(text){
 if(text.length<256*1024)return renderMarkdown(text);
 if(!parserWorker){parserWorker=new Worker(new URL('./preview-worker.js',import.meta.url),{type:'module'});parserWorker.onmessage=({data})=>{if(workerActive?.id!==data.id)return;const done=workerActive;workerActive=null;data.error?done.reject(Error(data.error)):done.resolve(data);if(workerQueued){const next=workerQueued;workerQueued=null;startParse(next)}};parserWorker.onerror=e=>{workerActive?.reject(Error(e.message));workerQueued?.reject(Error(e.message));workerActive=workerQueued=null;parserWorker.terminate();parserWorker=null};}
 return new Promise((resolve,reject)=>{const job={id:++workerId,text,resolve,reject};if(workerActive){workerQueued?.resolve(null);workerQueued=job}else startParse(job)});
}
 window.fpksDiagnostics=()=>({...metrics,cacheEntries:mathCache.entries.size,cacheBytes:mathCache.bytes,cacheHits:mathCache.hits,snippets:editor?.snippetCount,version:window.MathJax?.version,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family),docLength:editor?.view.state.doc.length??source.length,mode,session,scroll:scrollSync.diagnostics()});
window.addEventListener('error',e=>{status.textContent='错误：'+e.message;post({type:'error',message:e.message})});
window.addEventListener('unhandledrejection',e=>{status.textContent='错误：'+e.reason?.message;post({type:'error',message:String(e.reason?.stack||e.reason)})});
function setStatus(){status.textContent=dirty?'有未保存修改':'';}
function updateControls(){document.body.dataset.mode=mode;document.querySelector('#mode-toggle').textContent=mode==='read'?(editSession?'继续编辑':'编辑'):'阅读';document.querySelector('#source-toggle').textContent=mode==='source'?'显示预览':'隐藏预览';}
function applyTheme(data){
 if(data.colors){for(const [k,v]of Object.entries(data.colors))document.documentElement.style.setProperty('--'+k,v);
  const rgb=(data.colors.page||'#ffffff').slice(1),light=parseInt(rgb.slice(0,2),16)*.2126+parseInt(rgb.slice(2,4),16)*.7152+parseInt(rgb.slice(4,6),16)*.0722>128;
  document.body.classList.toggle('theme-light',light);document.body.classList.toggle('theme-dark',!light);document.documentElement.style.colorScheme=light?'light':'dark';
 }
 document.body.style.fontSize=(data.fontSize||19)+'px';
}
const mathPromise=ensureMath().then(()=>{mathReady=true;metrics.mathReadyMs=performance.now()-started;setStatus();post({type:'metrics',...metrics})});
async function prepareEditor(){
 if(editor)return editor;
 const requested=session;if(editorPreparing?.session===requested)return editorPreparing.promise;
 const promise=(async()=>{
  await mathPromise;
  [editorModule,settings,snippets]=await (editorResources??=Promise.all([import('./editor.js'),fetch(profileRoot+'suite-settings.json').then(r=>r.json()),fetch(profileRoot+'snippets.js').then(r=>r.text())]));
  if(session!==requested)return;
  const result=await editorModule.createEditor(document.querySelector('#editor'),source,settings,snippets,(changes,state)=>{
   if(applying||session!==requested)return;
   sourceStale=true;++generation;
   dirty=true;post({type:'changes',session,changes,cursor:state.selection.main.head});setStatus();queuePreview();
  },command=>{if(session!==requested)return;if(command==='read')void setMode('read');else post({type:command,session})});
  if(session!==requested){result.view.destroy();return;}
  editor=result;scrollSync.attach();setStatus();return editor;
 })();editorPreparing={session:requested,promise};return promise;
}
async function setMode(next,notify=true,savedAnchor){const requested=session,anchor=savedAnchor??scrollSync.capture();scrollSync.paused=true;mode=next;main.dataset.mode=next;
 if(next!=='read'){editSession=true;post({type:'edit',session});await prepareEditor();if(session!==requested||mode!==next)return;editor.view.requestMeasure();editor.view.focus();}
 updateControls();clearTimeout(previewTimer);
 if(next!=='source')await updatePreview(anchor);
 else requestAnimationFrame(()=>{scrollSync.restore(anchor);scrollSync.paused=false;});
 if(notify)post({type:'mode',mode:next,session});
}
function queuePreview(delay=source.length>1024*1024?400:120){clearTimeout(previewTimer);previewTimer=setTimeout(()=>void updatePreview(),delay)}
async function updatePreview(savedAnchor){
 if(mode==='source')return;
 const anchor=savedAnchor??(preview.children.length?scrollSync.capture():null);
 if(sourceStale&&editor){source=editor.view.state.doc.toString();sourceStale=false}
 const current=++generation,t=performance.now();
 observer?.disconnect();
 const rendered=await parsePreview(source);if(!rendered||current!==generation)return;
 const template=document.createElement('template');template.innerHTML=DOMPurify.sanitize(rendered.html,{ADD_ATTR:['data-equation','data-diagram','data-source-line','data-source-end'],FORBID_TAGS:['style','form','input','iframe','object'],FORBID_ATTR:['style']});
 // Preserve already rendered math on unchanged top-level blocks.
 const oldBlocks=[...preview.children],nextBlocks=[...template.content.children];
 for(let i=0;i<nextBlocks.length;i++){
  const next=nextBlocks[i],old=oldBlocks[i];
  const raw=next.outerHTML;
  if(old&&blockSources.get(old)===raw){next.replaceWith(old);continue}
  blockSources.set(next,raw);
 }
 preview.replaceChildren(template.content);
 scrollSync.dirty=true;
 for(const img of preview.querySelectorAll('img')){img.loading='lazy';img.decoding='async';if(bridge&&!/^[a-z]+:/i.test(img.getAttribute('src')||''))img.src=new URL(img.getAttribute('src'),'https://document.tinta.local/').href;}
 for(const node of preview.querySelectorAll('[data-diagram]:not([data-done])'))post({type:'diagram',session,generation:current,id:Number(node.dataset.diagram),source:rendered.diagrams[Number(node.dataset.diagram)]});
 const pending=[];
 for(const node of preview.querySelectorAll('[data-equation]:not([data-done])')){
  const equation=rendered.equations[Number(node.dataset.equation)];if(equation)pending.push({node,...equation});
 }
 await mathPromise;if(current!==generation)return;
 const work=new Map(pending.map(item=>[item.node,item]));
 observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const item=work.get(entry.target);if(!item)continue;observer.unobserve(item.node);work.delete(item.node);requestAnimationFrame(()=>{
   if(current!==generation||!item.node.isConnected)return;
   try{item.node.replaceChildren(renderMath(item.tex,item.display));item.node.dataset.done='1';metrics.equationsRendered++;scrollSync.layoutChanged();if(!firstMathPaint){firstMathPaint=true;requestAnimationFrame(()=>post({type:'mathVisible',session}))}}catch(e){item.node.textContent=item.tex;item.node.classList.add('math-error');post({type:'error',message:String(e)})}
  });}},{root:preview,rootMargin:'450px'});
 for(const item of pending)observer.observe(item.node);
 metrics.previewJobs++;metrics.lastPreviewMs=performance.now()-t;
 requestAnimationFrame(()=>{if(current!==generation)return;scrollSync.restore(anchor);scrollSync.paused=false;});
 setStatus();post({type:'metrics',...metrics,cacheBytes:mathCache.bytes,cacheEntries:mathCache.entries.size});
}
async function receive(data){
 if(data.type==='document'){
  ++generation;
  const anchor=path===data.path?scrollSync.capture():{line:0,side:'preview'};
  const changedSession=session!==data.session;session=data.session;path=data.path;source=data.text;sourceStale=false;dirty=!!data.dirty;editSession=!!data.edit;
  if(editor&&(changedSession||editor.view.state.doc.toString()!==source)){editor.view.destroy();editor=null;document.querySelector('#editor').replaceChildren();}
  scrollSync.reset();
  applyTheme(data);
  await setMode(data.mode||(data.edit?'split':'read'),false,anchor);setStatus();
 }else if(data.type==='mode'&&data.session===session){await setMode(data.mode,false)
 }else if(data.type==='profileChanged'){snippets=await fetch(profileRoot+'snippets.js',{cache:'no-store'}).then(r=>r.text());if(editor)await editor.reloadSnippets(snippets);if(editorResources)editorResources=Promise.resolve([editorModule,settings,snippets]);setStatus()}
 else if(data.type==='diagram'&&data.session===session&&data.generation===generation&&data.svg){const node=preview.querySelector(`[data-diagram="${data.id}"]`);if(node){node.innerHTML=DOMPurify.sanitize(data.svg,{USE_PROFILES:{svg:true,svgFilters:true}});node.dataset.done='1';scrollSync.layoutChanged()}}
 else if(data.type==='saved'){dirty=false;setStatus()}
 else if(data.type==='theme')applyTheme(data);
}
if(bridge)bridge.addEventListener('message',e=>void receive(e.data));
window.fpksReceive=receive;
document.querySelector('#mode-toggle').onclick=()=>void setMode(mode==='read'?'split':'read');
document.querySelector('#source-toggle').onclick=()=>void setMode(mode==='source'?'split':'source');
document.querySelector('#save').onclick=()=>post({type:'save',session});
async function printDocument(){
 if(sourceStale&&editor){source=editor.view.state.doc.toString();sourceStale=false}
 if(mode==='source')await setMode('read');
 await updatePreview();await mathPromise;
 const rendered=await parsePreview(source);
 if(!rendered)return;
 for(const node of preview.querySelectorAll('[data-equation]:not([data-done])')){const e=rendered.equations[Number(node.dataset.equation)];node.replaceChildren(renderMath(e.tex,e.display));node.dataset.done='1'}
 await document.fonts.ready;window.print();
}
document.querySelector('#print').onclick=()=>void printDocument();
preview.addEventListener('dblclick',()=>void setMode('split'));
preview.addEventListener('contextmenu',e=>{if(bridge){e.preventDefault();post({type:'contextMenu',session,x:Math.round(e.clientX*devicePixelRatio),y:Math.round(e.clientY*devicePixelRatio)})}});
preview.addEventListener('click',e=>{const link=e.target.closest('a');if(link&&bridge){e.preventDefault();post({type:'link',href:link.getAttribute('href'),session})}});
window.addEventListener('keydown',e=>{if(e.defaultPrevented)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();post({type:e.shiftKey?'saveAs':'save',session})}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'){e.preventDefault();void printDocument()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='e'){e.preventDefault();void setMode(mode==='read'?'split':'read')}else if(e.key==='Escape'&&editSession){e.preventDefault();post({type:'exitEdit',session})}else if(mode==='read'&&!e.ctrlKey&&!e.altKey&&e.key.toLowerCase()==='e'){e.preventDefault();void setMode('split')}});
metrics.readyMs=performance.now()-started;post({type:'ready'});
if(!bridge)void receive({type:'document',session:'browser-test',text:'# FPKS 数学验证\n\n行内 $\\dfrac{a}{b}$ 与 $\\vec a$。\n\n$$\\begin{cases}\\frac{1}{x} & x>0\\\\0 & x=0\\end{cases}$$',path:'test.md'});
