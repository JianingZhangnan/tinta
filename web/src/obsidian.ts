import {StateField} from '@codemirror/state';
export const Platform={isMacOS:false,isWin:true,isDesktop:true,isMobile:false,isMobileApp:false};
export class Notice { constructor(text:unknown) {console.warn('LaTeX Suite:',text);} hide() {} }
export const editorLivePreviewField=StateField.define({create:()=>false,update:v=>v});
export const renderMath=(tex:string,display:boolean)=>window.MathJax.tex2chtml(tex,{display});
export const finishRenderMath=()=>{};
export function debounce(fn:Function,ms:number,reset=true){let timer:any;const f:any=(...a:any[])=>{if(reset)clearTimeout(timer);timer=setTimeout(()=>fn(...a),ms)};f.cancel=()=>clearTimeout(timer);return f;}
export const livePreviewState=null;

// The upstream suite uses Obsidian's small DOM/collection conveniences.
const def=(p:any,k:string,v:any)=>{if(!(k in p))Object.defineProperty(p,k,{value:v,configurable:true});};
def(String.prototype,'contains',String.prototype.includes);
def(Array.prototype,'last',function(){return this[this.length-1]});
def(Array.prototype,'first',function(){return this[0]});
def(Array.prototype,'contains',Array.prototype.includes);
def(Array.prototype,'remove',function(v:any){const i=this.indexOf(v);if(i>=0)this.splice(i,1)});
def(HTMLElement.prototype,'empty',function(){this.replaceChildren()});
def(HTMLElement.prototype,'addClass',function(...v:string[]){this.classList.add(...v)});
def(HTMLElement.prototype,'removeClass',function(...v:string[]){this.classList.remove(...v)});
def(HTMLElement.prototype,'setText',function(v:string){this.textContent=v});
def(HTMLElement.prototype,'setCssProps',function(v:any){for(const [k,x]of Object.entries(v))this.style.setProperty(k,String(x))});
def(HTMLElement.prototype,'getText',function(){return this.textContent||''});
def(HTMLElement.prototype,'find',function(s:string){return this.querySelector(s)});
def(HTMLElement.prototype,'findAll',function(s:string){return [...this.querySelectorAll(s)]});
function createEl(tag:string,o:any={}){const e=document.createElement(tag);if(o.text)e.textContent=o.text;if(o.cls)e.className=o.cls;return e;}
for(const p of [HTMLElement.prototype,DocumentFragment.prototype]) {
 def(p,'createEl',function(tag:string,o:any={}){const e=createEl(tag,o);this.append(e);return e});
 def(p,'createDiv',function(o:any={},cb?:Function){const e=this.createEl('div',o);cb?.(e);return e});
 def(p,'appendText',function(s:string){this.append(document.createTextNode(s))});
}
Object.assign(globalThis,{createEl,createDiv:(o:any)=>createEl('div',o),createFragment:()=>document.createDocumentFragment()});
