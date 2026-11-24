// Both panes use Markdown source lines as anchors. Pixel percentages drift
// whenever a formula, table or wrapped paragraph has a different height.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function interpolate(points,value,key,result){
 if(!points.length)return 0;
 let lo=0,hi=points.length-1;
 while(lo<hi){const mid=(lo+hi+1)>>1;if(points[mid][key]<=value)lo=mid;else hi=mid-1;}
 const a=points[lo],b=points[Math.min(lo+1,points.length-1)];
 if(a===b||b[key]<=a[key])return a[result];
 return a[result]+clamp((value-a[key])/(b[key]-a[key]),0,1)*(b[result]-a[result]);
}
export class ScrollSync {
 constructor(preview,getEditor,getMode){
  this.preview=preview;this.getEditor=getEditor;this.getMode=getMode;
  this.owner='preview';this.points=[];this.dirty=true;this.expected={};this.hold={};this.paused=false;
  this.listen(preview,'preview');
  window.addEventListener('resize',()=>this.layoutChanged());
  preview.addEventListener('load',()=>this.layoutChanged(),true);
  document.fonts.addEventListener('loadingdone',()=>this.layoutChanged());
 }
 listen(node,side){
  const intent=e=>{this.owner=side;delete this.expected[side];delete this.hold[side];this.edge=e.type==='keydown'&&(e.ctrlKey||e.metaKey)?(e.key==='End'?'bottom':e.key==='Home'?'top':null):null;if(this.edge)this.schedule();};
  for(const name of ['wheel','pointerdown','touchstart','keydown'])node.addEventListener(name,intent,{passive:true});
  node.addEventListener('scroll',()=>{
   if(this.paused||this.getMode()!=='split')return;
   if(performance.now()<(this.hold[side]||0))return;
   if(Math.abs(node.scrollTop-(this.expected[side]??-100))<2)return;
   this.owner=side;this.schedule();
  },{passive:true});
 }
 attach(){const view=this.getEditor()?.view;if(view&&this.attached!==view){this.attached=view;this.listen(view.scrollDOM,'editor');}}
 reset(){this.points=[];this.dirty=true;this.owner='preview';this.expected={};this.hold={};this.edge=null;}
 rebuild(){
  if(!this.dirty)return;
  const p=this.preview,origin=p.getBoundingClientRect().top-p.scrollTop,lines=new Map();
  for(const node of p.querySelectorAll('[data-source-line]')){
   const rect=node.getBoundingClientRect(),line=Number(node.dataset.sourceLine),end=Number(node.dataset.sourceEnd);
   if(!rect.height||!Number.isSafeInteger(line)||line<0||!Number.isSafeInteger(end)||end<=line)continue;
   lines.set(line,Math.max(lines.get(line)||0,rect.top-origin));
   if(end>line)lines.set(end,Math.max(lines.get(end)||0,rect.bottom-origin));
  }
  lines.set(0,0);let y=0;
  this.points=[...lines].sort((a,b)=>a[0]-b[0]).map(([line,top])=>({line,y:y=Math.max(y,top)}));
  this.dirty=false;
 }
 capture(side=this.getMode()==='source'?'editor':this.owner){
  const editor=this.getEditor();
  if(side==='editor'&&editor&&this.getMode()!=='read'){const anchor=editor.scrollAnchor();return {...anchor,line:this.edge==='top'?0:anchor.line,bottom:this.edge==='bottom'||anchor.bottom,side};}
  this.rebuild();const p=this.preview,max=p.scrollHeight-p.clientHeight;
  return {line:interpolate(this.points,p.scrollTop,'y','line'),bottom:max>2&&p.scrollTop>=max-2,side:'preview'};
 }
 writePreview(anchor){
  this.rebuild();const p=this.preview,max=Math.max(0,p.scrollHeight-p.clientHeight);
  const top=anchor.bottom?max:clamp(interpolate(this.points,anchor.line,'line','y'),0,max);
  this.expected.preview=top;this.hold.preview=performance.now()+80;p.scrollTop=top;
 }
 writeEditor(anchor){
  const editor=this.getEditor();if(!editor)return;
  this.hold.editor=performance.now()+120;
  editor.scrollToAnchor(anchor,()=>{this.expected.editor=editor.view.scrollDOM.scrollTop;});
 }
 restore(anchor,mode=this.getMode()){
  if(!anchor)return;
  this.attach();this.owner=anchor.side||this.owner;
  if(mode!=='source')this.writePreview(anchor);
  if(mode!=='read')this.writeEditor(anchor);
 }
 schedule(){
  if(this.frame)return;
  this.frame=requestAnimationFrame(()=>{this.frame=0;if(this.paused||this.getMode()!=='split')return;const anchor=this.capture();if(this.owner==='editor')this.writePreview(anchor);else this.writeEditor(anchor);});
 }
 layoutChanged(){this.dirty=true;this.schedule();}
 diagnostics(){return {owner:this.owner,editor:this.getEditor()?.scrollAnchor().line??0,preview:this.capture('preview').line};}
}
