import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../../dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';if(rel.split('/').includes('..'))return res.writeHead(403).end();try{const data=await fs.readFile(path.join(root,rel));res.writeHead(200,{'Content-Type':types[path.extname(rel)]??'application/octet-stream'}).end(data);}catch{res.writeHead(404).end();}}).listen(43988,'127.0.0.1',()=>console.log('Production build http://127.0.0.1:43988'));
