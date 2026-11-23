import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
export const markdown=new MarkdownIt({html:true,linkify:true,typographer:false}).use(footnote);
let equations=[],diagrams=[];
const fence=markdown.renderer.rules.fence;
markdown.renderer.rules.fence=(tokens,index,options,env,self)=>{
 const token=tokens[index];
 if(token.info.trim().toLowerCase()!=='mermaid')return fence(tokens,index,options,env,self);
 const id=diagrams.length;diagrams.push(token.content);
 return `<div class="diagram" data-diagram="${id}">${fence(tokens,index,options,env,self)}</div>`;
};
function escaped(s,i){let n=0;while(i>0&&s[--i]==='\\')n++;return !!(n%2)}
markdown.inline.ruler.after('escape','fpks-math',(state,silent)=>{
 const start=state.pos,s=state.src;if(s[start]!=='$'||escaped(s,start))return false;
 const count=s[start+1]==='$'?2:1;if(count===1&&/\s/.test(s[start+1]||''))return false;let end=start+count;
 while((end=s.indexOf('$'.repeat(count),end))>=0){if(!escaped(s,end)&&(count===2||(!/\s/.test(s[end-1])&&!/\d/.test(s[end+1]||''))))break;end+=count}
 if(end<0||end===start+count)return false;
 if(!silent){const t=state.push('fpks_math','',0);t.content=s.slice(start+count,end);t.meta={display:count===2};}
 state.pos=end+count;return true;
});
markdown.block.ruler.before('fence','fpks-math-block',(state,line,end,silent)=>{
 const start=state.bMarks[line]+state.tShift[line];if(!state.src.startsWith('$$',start))return false;
 const contentStart=start+2;let close=state.src.indexOf('$$',contentStart);
 if(close<0)return false;
 let last=line;while(last<end&&state.eMarks[last]<close+2)last++;
 if(last>=end||state.src.slice(close+2,state.eMarks[last]).trim())return false;
 if(silent)return true;
 const token=state.push('fpks_math','',0);token.block=true;token.content=state.src.slice(contentStart,close);token.meta={display:true};token.map=[line,last+1];state.line=last+1;return true;
},{alt:['paragraph','reference','blockquote','list']});
markdown.renderer.rules.fpks_math=(tokens,index)=>{const token=tokens[index],id=equations.length;equations.push({tex:token.content,display:token.meta.display});const tag=token.meta.display?'div':'span';return `<${tag} class="math ${token.meta.display?'math-block':'math-inline'}" data-equation="${id}"></${tag}>`};
export function renderMarkdown(source){equations=[];diagrams=[];return {html:markdown.render(source),equations,diagrams};}
