import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backupRoute} from '../backend/backups.js';
import {handle} from '../backend/api.js';
import {database} from './d1.js';
const reply=(b,s=200)=>Response.json(b,{status:s});
const path='/api/admin/backups';
const request=new Request('https://test.local'+path);
const env={BACKUP_GITHUB_READ_TOKEN:'test-read-only-secret'};
const run={id:7,path:'.github/workflows/paraspots-backup.yml',head_branch:'main',conclusion:'success',status:'completed',updated_at:'2026-11-10T03:30:00Z'};
const artifact={id:11,name:'paraspots-backup-7-1',expired:false,workflow_run:{id:7},size_in_bytes:200,created_at:'2026-11-10T03:20:00Z',expires_at:'2027-02-08T03:20:00Z'};
function fake(overrides={}) {return async(url,opts)=>{
 if(url==='https://storage.example.test/signed') {assert.equal(opts.headers,undefined);return new Response('encrypted zip');}
 assert.equal(opts.headers.Authorization,'Bearer test-read-only-secret');
 if(url.endsWith('/zip'))return new Response(null,{status:302,headers:{Location:overrides.location||'https://storage.example.test/signed'}});
 if(url.endsWith('/actions/artifacts/11'))return Response.json({...artifact,...overrides.artifact});
 if(url.endsWith('/actions/runs/7'))return Response.json({...run,...overrides.run});
 if(url.includes('/artifacts?'))return Response.json({artifacts:[artifact,{...artifact,id:99,expired:true},{...artifact,id:88,name:'unrelated'}]});
 if(url.includes('/runs?'))return Response.json({workflow_runs:[{...run,...overrides.run}]});
 return Response.json({private:overrides.private??true});
};}
test('backup route remains behind existing Superadmin authentication',async()=>{
 const response=await handle(new Request('https://test.local/api/admin/backups'),{SITE_DB:database()});assert.equal(response.status,401);
});
test('unconfigured provider does not report success',async()=>{const r=await backupRoute({request,path,env:{},reply});assert.equal(r.status,503);assert.equal((await r.json()).configured,false);});
test('only private storage and successful verified workflow runs are listed',async()=>{
 let r=await backupRoute({request,path,env,reply,fetcher:fake()});assert.deepEqual((await r.json()).backups.map(a=>a.id),[11]);
 r=await backupRoute({request,path,env,reply,fetcher:fake({run:{conclusion:'failure'}})});assert.equal((await r.json()).backups.length,0);
 r=await backupRoute({request,path,env,reply,fetcher:fake({private:false})});assert.equal(r.status,503);
});
test('download does not forward GitHub token to signed storage',async()=>{const r=await backupRoute({request,path:path+'/11/download',env,reply,fetcher:fake()});assert.equal(r.status,200);assert.equal(await r.text(),'encrypted zip');});
test('failed restore, wrong workflow and expired archive cannot download',async()=>{
 for(const overrides of [{run:{conclusion:'failure'}},{run:{path:'evil.yml'}},{run:{head_branch:'other'}},{artifact:{expired:true}}]){
 const r=await backupRoute({request,path:path+'/11/download',env,reply,fetcher:fake(overrides)});assert.ok([404,409].includes(r.status));
 }
});
test('unsafe download URL and all mutations are rejected',async()=>{
 let r=await backupRoute({request,path:path+'/11/download',env,reply,fetcher:fake({location:'http://storage.example.test/signed'})});assert.equal(r.status,502);
 r=await backupRoute({request:new Request('https://test.local'+path,{method:'DELETE'}),path,env,reply});assert.equal(r.status,405);
});
test('Cloudflare-compatible fetch rejects unexpected redirects without forwarding credentials',async()=>{
 const redirecting=async(_url,opts)=>{assert.equal(opts.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://unexpected.example.test/'}});};
 await assert.rejects(()=>backupRoute({request,path,env,reply,fetcher:redirecting}),/HTTP 302/);
 const normal=fake();const fetcher=async(url,opts)=>{assert.equal(opts.redirect,'manual');return url==='https://storage.example.test/signed'?redirecting(url,opts):normal(url,opts);};
 const r=await backupRoute({request,path:path+'/11/download',env,reply,fetcher});assert.equal(r.status,502);
});
test('runtime restore date is reported only when valid and not in the future',async()=>{
 for(const [stamp,expected] of [['2026-01-01T00:00:00Z','2026-01-01T00:00:00Z'],['invalid',null],['2099-01-01T00:00:00Z',null]]){
  const r=await backupRoute({request,path,env:{...env,COCKPIT_RUNTIME_RESTORE_VERIFIED_AT:stamp},reply,fetcher:fake()});assert.equal((await r.json()).runtimeRestoreVerifiedAt,expected);
 }
});
