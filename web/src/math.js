const profileRoot=location.hostname==='tinta.local'?'https://fpks.tinta.local/':'/profile/';
export {profileRoot};
let ready;
export function ensureMath(){return ready??=(async()=>{
 const {Plugin,loadMathJax}=await loadRenderer();
 return window.MathJax;
})();}
async function loadRenderer(){
 const source=(await (await fetch(profileRoot+'main.js')).text()).replace('assistiveMml: [],','assistiveMml: [], attachSpeech: [], enrich: [], complexity: [],');
 const mod={exports:{}};
 class HostPlugin {addStatusBarItem(){return {setText(){}}}addCommand(){}register(){}registerEvent(){}}
 const host={Plugin:HostPlugin,MarkdownView:class{},Notice:class{constructor(s){console.info(s)}},normalizePath:p=>p,loadMathJax:async()=>{window.MathJax??={version:'3.host'}}};
 new Function('require','module',source)(name=>{if(name==='obsidian')return host;throw Error(name)},mod);
 const plugin=new mod.exports();
 plugin.getResourceUrl=p=>new URL(p,new URL(profileRoot,location.href)).href;
 plugin.app={workspace:{trigger(){},getLeavesOfType(){return[]}}};
 await plugin.onload();
 if(!document.body.classList.contains('mathjax4-pagella-active'))throw Error('FPKS MathJax initialization failed');
 // FPKS disables speech/explorer. Remove their actions as well: conversion
 // documents otherwise inherit an unused speech-worker action from the
 // combined component, despite these features being disabled in the host.
 const doc=window.MathJax.startup.document;
 for(const action of ['attachSpeech','enrich','complexity']){
  doc.renderActions.remove(action);
  window.MathJax.config.options.renderActions[action]=[];
 }
 const autoSource=await (await fetch(profileRoot+'auto-displaystyle.js')).text();
 const autoMod={exports:{}};
 new Function('require','module',autoSource)(()=>host,autoMod);
 const auto=new autoMod.exports();auto.enabled=true;auto.install();
 for(const name of ['inline-math-zoom.css','block-math-zoom.css','math-theme.css','suite.css']) {
  const style=document.createElement('link');style.rel='stylesheet';style.href=profileRoot+name;document.head.append(style);
 }
 window.fpksRenderer=plugin;
 return host;
}

// Bounded by count and serialized size: a long session cannot retain every
// visited equation. Cached templates are detached, with no observers/listeners.
export class MathCache {
 constructor(maxEntries=256,maxBytes=4*1024*1024){this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.bytes=0;this.entries=new Map();this.hits=0;this.misses=0;}
 get(key){const value=this.entries.get(key);if(!value){this.misses++;return null}this.hits++;this.entries.delete(key);this.entries.set(key,value);return value.node.cloneNode(true)}
 put(key,node){const bytes=key.length*2+node.outerHTML.length*2;if(bytes>this.maxBytes)return;const old=this.entries.get(key);if(old){this.bytes-=old.bytes;this.entries.delete(key)}this.entries.set(key,{node:node.cloneNode(true),bytes});this.bytes+=bytes;while(this.entries.size>this.maxEntries||this.bytes>this.maxBytes){const k=this.entries.keys().next().value;this.bytes-=this.entries.get(k).bytes;this.entries.delete(k)}}
}
export const mathCache=new MathCache();
export function renderMath(tex,display){const key=(display?'D:':'I:')+tex;const hit=mathCache.get(key);if(hit)return hit;const node=window.MathJax.tex2chtml(tex,{display});mathCache.put(key,node);return node;}
