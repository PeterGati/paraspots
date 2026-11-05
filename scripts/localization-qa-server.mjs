// Isolated QA: in-memory data, test-only credentials, no production writes.
import {createServer} from 'node:http';import {readFileSync,existsSync} from 'node:fs';import {resolve,extname} from 'node:path';import {pbkdf2Sync} from 'node:crypto';
import {database} from '../tests/d1.js';import {handle} from '../backend/api.js';
const env={SITE_DB:database(),ADMIN_EMAIL:'qa@example.test',ADMIN_PASSWORD_HASH:'pbkdf2$100000$qa$'+pbkdf2Sync('local-qa-only','qa',100000,32,'sha256').toString('hex')};
const root=resolve('out/preview');
createServer(async(req,res)=>{try{
 if(req.url.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const response=await handle(new Request('http://127.0.0.1:4175'+req.url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
 const path=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!path.startsWith(root+'/')||!existsSync(path)){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[extname(path)]||'application/octet-stream'});res.end(readFileSync(path));
}catch(e){console.error(e.message);res.writeHead(500).end();}}).listen(4175,'127.0.0.1',()=>console.log('Isolated localization QA on port 4175'));
