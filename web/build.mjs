import {build} from 'esbuild';
import {mkdir, copyFile,readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {buildParserFile} from '@lezer/generator';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const parserDir=path.join(root,'../third_party/latex-suite/src/parser/mathjax');
const generated=buildParserFile(await readFile(path.join(parserDir,'latex.grammar'),'utf8'));
await writeFile(path.join(parserDir,'latex-parser.js'),generated.parser);
await writeFile(path.join(parserDir,'latex-parser.terms.js'),generated.terms);
await mkdir(path.join(root,'dist'),{recursive:true});
const bundle=await build({entryPoints:['app.js','editor.ts','preview-worker.js'].map(n=>path.join(root,'src',n)),metafile:true,
  outdir:path.join(root,'dist'),bundle:true,minify:true,splitting:true,format:'esm',target:'chrome120',
  alias:{obsidian:path.join(root,'src/obsidian.ts'),'src':path.join(root,'../third_party/latex-suite/src')},
  nodePaths:[path.join(root,'node_modules')],
  plugins:[{name:'inline-source',setup(b){b.onResolve({filter:/^inline:/},a=>({path:path.resolve(a.resolveDir,a.path.slice(7)),namespace:'inline-source'}));b.onLoad({filter:/.*/,namespace:'inline-source'},async a=>({contents:await readFile(a.path,'utf8'),loader:'text'}));}}],
  tsconfigRaw:{compilerOptions:{useDefineForClassFields:false,baseUrl:path.join(root,'../third_party/latex-suite'),paths:{'src/*':['src/*']}}},
  banner:{js:'var require = (name) => { throw new Error("Unsupported module: " + name); };'},
  loader:{'.svg':'text'},logLevel:'info'});
// Esbuild leaves old hashed chunks behind. Remove only obsolete generated
// JavaScript files, so rebuilds and portable packages do not grow indefinitely.
const currentOutputs=new Set(Object.keys(bundle.metafile.outputs).map(file=>path.resolve(file)));
for(const file of await readdir(path.join(root,'dist'))){
 const absolute=path.join(root,'dist',file);
 if(file.endsWith('.js')&&!currentOutputs.has(absolute))await unlink(absolute);
}
for(const name of ['index.html','style.css']) await copyFile(path.join(root,'src',name),path.join(root,'dist',name));
const packages=new Set(Object.keys(bundle.metafile.inputs).map(file=>file.replaceAll('\\','/').match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean));
let notices='Tinta FPKS web dependencies\n\nLaTeX Suite 1.12.8\n'+await readFile(path.join(root,'../third_party/latex-suite/LICENSE.md'),'utf8');
for(const name of [...packages].sort()){
 const dir=path.join(root,'node_modules',name),pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));
 const licenses=(await readdir(dir)).filter(file=>/^(licen[sc]e|copying)([.\-_]|$)/i.test(file));
 notices+=`\n\n${name} ${pkg.version} (${pkg.license||'see license'})\n`;
 for(const file of licenses)notices+=await readFile(path.join(dir,file),'utf8')+'\n';
}
await writeFile(path.join(root,'dist/THIRD_PARTY_NOTICES.txt'),notices);
