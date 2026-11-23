import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const profile=path.join(process.env.APPDATA,'Tinta','fpks-profile');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.woff2':'font/woff2'};
export function server(){return http.createServer(async(req,res)=>{try{const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const base=url.startsWith('/profile/')?profile:path.join(root,'dist');const relative=url.startsWith('/profile/')?url.slice(9):url==='/'?'index.html':url.slice(1);const file=path.resolve(base,relative);if(!file.startsWith(base+path.sep))throw Error('Invalid path');const data=await fs.readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(data)}catch{res.writeHead(404);res.end()}})}
if(process.argv[1]===fileURLToPath(import.meta.url)){server().listen(18734,'127.0.0.1',()=>console.log('FPKS test server http://127.0.0.1:18734'))}
