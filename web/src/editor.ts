import {EditorState,Prec,Transaction,Compartment} from '@codemirror/state';
import {EditorView,keymap,lineNumbers,drawSelection,highlightActiveLine,tooltips} from '@codemirror/view';
import {history,historyKeymap,defaultKeymap,indentWithTab} from '@codemirror/commands';
import {searchKeymap,highlightSelectionMatches} from '@codemirror/search';
import {markdown} from '@codemirror/lang-markdown';
import {syntaxHighlighting,defaultHighlightStyle} from '@codemirror/language';
import {getLatexSuiteConfigExtension} from '../../third_party/latex-suite/src/snippets/codemirror/config';
import {processLatexSuiteSettings,DEFAULT_SETTINGS} from '../../third_party/latex-suite/src/settings/settings';
import {parseSnippets} from '../../third_party/latex-suite/src/snippets/parse';
import {handleUpdate,onInput,keyboardEventPlugin,getKeymaps} from '../../third_party/latex-suite/src/latex_suite';
import {snippetExtensions} from '../../third_party/latex-suite/src/snippets/codemirror/extensions';
import {contextPlugin,mathBoundsPlugin} from '../../third_party/latex-suite/src/utils/context';
import {languageExtension} from '../../third_party/latex-suite/src/parser/language';
import {colorPairedBracketsPluginLowestPrec,highlightCursorBracketsPlugin} from '../../third_party/latex-suite/src/editor_extensions/highlight_brackets';
import {cursorTooltipField,cursorTooltipBaseTheme} from '../../third_party/latex-suite/src/editor_extensions/math_tooltip';
import {highlight_dollar} from '../../third_party/latex-suite/src/editor_extensions/highlight_dollar';
import {editorLivePreviewField} from './obsidian';
export async function createEditor(parent:HTMLElement,doc:string,settings:any,snippetSource:string,onChange:Function,onCommand:Function){
 const config={...DEFAULT_SETTINGS,...settings};
 const snippets=await parseSnippets(snippetSource,{},'fpks-shared-snippets.js');
 const cm=processLatexSuiteSettings(snippets,config),suiteConfig=new Compartment();
 const extensions:any[]=[
  EditorState.allowMultipleSelections.of(true),editorLivePreviewField,
  EditorView.clipboardInputFilter.of(text=>config.pasteMathConversion===false?text:text.replace(/\\\((.*?)\\\)/g,(_,s)=>'$'+s.trim()+'$').replace(/\\\[(.*?)\\\]/gs,(_,s)=>'\n$$\n'+s.trim()+'\n$$\n')),
  Prec.highest(mathBoundsPlugin.extension),Prec.highest(contextPlugin.extension),suiteConfig.of([getLatexSuiteConfigExtension(cm),keymap.of(getKeymaps(cm))]),
  Prec.highest(keyboardEventPlugin.extension),Prec.highest(EditorView.inputHandler.of(onInput)),
  EditorView.updateListener.of(handleUpdate),snippetExtensions,languageExtension,
  markdown(),lineNumbers(),drawSelection(),highlightActiveLine(),history(),highlightSelectionMatches(),
  syntaxHighlighting(defaultHighlightStyle),EditorView.lineWrapping,
  keymap.of([{key:'Mod-s',run:()=>{onCommand('save');return true}},
    {key:'Mod-Shift-s',run:()=>{onCommand('saveAs');return true}},
    {key:'Mod-o',run:()=>{onCommand('open');return true}},
    {key:'Mod-Shift-e',run:()=>{onCommand('read');return true}},
    ...historyKeymap,...searchKeymap,...defaultKeymap,indentWithTab]),
  EditorView.updateListener.of(u=>{if(u.docChanged){const changes:any[]=[];u.changes.iterChanges((from,to,_f,_t,insert)=>changes.push({from,to,insert:insert.toString()}));onChange(changes,u.state)}}),
  EditorView.theme({'&':{height:'100%',fontSize:'17px',backgroundColor:'var(--page)',color:'var(--ink)'},'.cm-content':{fontFamily:'Cascadia Code,monospace',padding:'20px 16px 180px'},'.cm-scroller':{overflow:'auto'},'.cm-gutters':{backgroundColor:'var(--page)',color:'var(--muted)',border:'none'},'.cm-cursor':{borderLeftColor:'var(--ink)'},'&.cm-focused .cm-selectionBackground, .cm-selectionBackground':{backgroundColor:'#b8cce680'},'.cm-tooltip':{maxWidth:'80vw',backgroundColor:'var(--page)',color:'var(--ink)'},'.cm-tooltip mjx-container':{fontSize:'19px'}}),
 ];
 if(cm.colorPairedBracketsEnabled)extensions.push(colorPairedBracketsPluginLowestPrec);
 if(cm.highlightCursorBracketsEnabled)extensions.push(highlightCursorBracketsPlugin.extension);
 if(cm.mathPreviewEnabled)extensions.push(cursorTooltipField.extension,cursorTooltipBaseTheme,tooltips({position:'absolute'}));
 if(cm.highlightDollarEnabled)extensions.push(highlight_dollar);
 const view=new EditorView({parent,state:EditorState.create({doc,extensions})});
 const result={view,snippetCount:snippets.length,async reloadSnippets(source:string){const next=await parseSnippets(source,{},'fpks-shared-snippets.js');const nextConfig=processLatexSuiteSettings(next,config);view.dispatch({effects:suiteConfig.reconfigure([getLatexSuiteConfigExtension(nextConfig),keymap.of(getKeymaps(nextConfig))])});result.snippetCount=next.length}};
 return result;
}
