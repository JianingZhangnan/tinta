import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
export const markdown=new MarkdownIt({html:true,linkify:true,typographer:false}).use(footnote);
let equations=[],diagrams=[];
function sourceAttributes(token){return token.map?` data-source-line="${token.map[0]}" data-source-end="${token.map[1]}"`:''}
markdown.core.ruler.after('block','fpks-source-lines',state=>{
 for(const token of state.tokens)if(token.map&&token.block&&token.nesting!==-1){token.attrSet('data-source-line',token.map[0]);token.attrSet('data-source-end',token.map[1]);}
});
const fence=markdown.renderer.rules.fence;
markdown.renderer.rules.fence=(tokens,index,options,env,self)=>{
 const token=tokens[index];
 if(token.info.trim().toLowerCase()!=='mermaid')return fence(tokens,index,options,env,self).replace('<pre',`<pre${sourceAttributes(token)}`);
 const id=diagrams.length;diagrams.push(token.content);
 return `<div class="diagram" data-diagram="${id}"${sourceAttributes(token)}>${fence(tokens,index,options,env,self)}</div>`;
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
 if(state.sCount[line]-state.blkIndent>=4)return false;
 const start=state.bMarks[line]+state.tShift[line];if(!state.src.startsWith('$$',start))return false;
 // Markdown containers adjust bMarks/tShift rather than rewriting src.
 // Read those logical lines: a raw src slice leaks every quote marker
 // into TeX, including the marker before the closing $$.
 const parts=[];let last=line,closed=false;
 for(;last<end;last++){
  const pos=state.bMarks[last]+state.tShift[last];
  if(last>line&&pos<state.eMarks[last]&&state.sCount[last]<state.blkIndent)break;
  const text=last===line?state.src.slice(start+2,state.eMarks[last]):state.getLines(last,last+1,state.blkIndent,false);
  let close=-1;
  while((close=text.indexOf('$$',close+1))>=0)if(!escaped(text,close))break;
  if(close>=0){
   if(text.slice(close+2).trim())return false;
   parts.push(text.slice(0,close));closed=true;break;
  }
  parts.push(text);
 }
 if(!closed)return false;
 if(silent)return true;
 const token=state.push('fpks_math','',0);token.block=true;token.content=parts.join('\n');token.meta={display:true};token.map=[line,last+1];state.line=last+1;return true;
},{alt:['paragraph','reference','blockquote','list']});
markdown.renderer.rules.fpks_math=(tokens,index)=>{const token=tokens[index],id=equations.length;equations.push({tex:token.content,display:token.meta.display});const tag=token.meta.display?'div':'span';return `<${tag} class="math ${token.meta.display?'math-block':'math-inline'}" data-equation="${id}"${sourceAttributes(token)}></${tag}>`};
export function renderMarkdown(source){equations=[];diagrams=[];return {html:markdown.render(source),equations,diagrams};}
