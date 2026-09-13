import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../../../..');
const routes={
  '/':path.join(here,'index.html'),
  '/card-art.mjs':path.join(repo,'web/public/card-art.mjs'),
  '/observations.json':path.resolve(here,'../../integration-diagnostic/slide-contact/observations.json'),
};
const roots={'/rgb/':path.resolve(here,'../mattes/slide/frames'),'/masks/':path.resolve(here,'../composite-draft/slide-rg')};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  let file=routes[url.pathname];
  for(const [prefix,root] of Object.entries(roots))if(url.pathname.startsWith(prefix)){
    const name=url.pathname.slice(prefix.length);
    if(/^\d{4}\.png$/.test(name))file=path.join(root,name);
  }
  if(!file){res.writeHead(404);res.end();return;}
  try{const s=await stat(file);res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':file.endsWith('.json')?'application/json':file.endsWith('.mjs')?'text/javascript':'text/html','Content-Length':s.size,'Cache-Control':'no-store'});createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end('Asset not ready');}
}).listen(4189,'127.0.0.1',()=>console.log('Staging contact viewer http://127.0.0.1:4189'));
