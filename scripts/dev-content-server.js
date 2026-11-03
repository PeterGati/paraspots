// Local preview only. Cloudflare production uses D1 and Pages Functions.
import {createServer} from 'node:http';import {readFileSync,existsSync} from 'node:fs';import {resolve,extname} from 'node:path';
import {handle} from '../backend/api.js';import {database} from '../tests/d1.js';
const root=resolve('out/preview');
const vars=Object.fromEntries(readFileSync('.dev.vars','utf8').trim().split('\n').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),JSON.parse(x.slice(i+1))];}));
const env={...vars,SITE_DB:database('.qa/content-local.sqlite')};
createServer(async(req,res)=>{
 try{
 if(req.url.startsWith('/api/')){
  const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>262144){res.writeHead(413).end();return;}chunks.push(chunk);}
  const response=await handle(new Request('http://127.0.0.1:4174'+req.url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})}),env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 const path=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]).replace(/\/$/,'/index.html'));
 if(!path.startsWith(root+'/')||!existsSync(path)){res.writeHead(404).end();return;}
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png'};
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});res.end(readFileSync(path));
 }catch{res.writeHead(500).end();}
}).listen(4174,'127.0.0.1',()=>console.log('Local superadmin: http://127.0.0.1:4174/superadmin/'));
