// Read-only backup gateway; called only AFTER existing Superadmin session validation.
// The Cloudflare secret has GitHub Actions:read only, no repository write permission.
const workflow = '.github/workflows/paraspots-backup.yml';
export async function backupRoute({request,path,env,reply,fetcher=fetch}) {
 if(request.method!=='GET')return reply({error:'Csak olvasási művelet engedélyezett.'},405);
 if(!env.BACKUP_GITHUB_READ_TOKEN)return reply({configured:false,backups:[],error:'A központi mentés még nincs aktiválva.'},503);
 const root='https://api.github.com/repos/PeterGati/paraspots-backups';
 const headers={'Authorization':`Bearer ${env.BACKUP_GITHUB_READ_TOKEN}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PARASPOTS-backup'};
 const get=async route=>{const r=await fetcher(root+route,{headers,redirect:'manual'});if(!r.ok)throw Error('Backup provider HTTP '+r.status+' at '+route.split('?')[0]);return r.json();};
 const repository=await get('');
 if(repository.private!==true)return reply({error:'A mentési tárhelynek privátnak kell lennie.'},503);
 if(path==='/api/admin/backups') {
  const runs=await get('/actions/workflows/paraspots-backup.yml/runs?branch=main&per_page=30');
  const successful=runs.workflow_runs.filter(r=>r.conclusion==='success'&&r.path===workflow&&r.head_branch==='main');
  // Enumerate by successful runs: unrelated artifacts cannot hide backups through pagination.
  const backups=[];
  for(const run of successful.slice(0,10)) {
   const data=await get(`/actions/runs/${run.id}/artifacts?per_page=100`);
   for(const a of data.artifacts)if(/^paraspots-backup-\d+-\d+$/.test(a.name)&&!a.expired)backups.push({id:a.id,name:a.name,bytes:a.size_in_bytes,createdAt:a.created_at,expiresAt:a.expires_at,digest:a.digest??null,runID:run.id,verifiedAt:run.updated_at});
  }
  const last=runs.workflow_runs[0];
  const restored=Date.parse(env.COCKPIT_RUNTIME_RESTORE_VERIFIED_AT||'');
  const runtimeRestoreVerifiedAt=Number.isFinite(restored)&&restored<=Date.now()?env.COCKPIT_RUNTIME_RESTORE_VERIFIED_AT:null;
  return reply({configured:true,backups,lastRun:last?{status:last.status,conclusion:last.conclusion,at:last.updated_at,verified:backups.some(a=>a.runID===last.id)}:null,runtimeRestoreVerifiedAt,restoreScope:runtimeRestoreVerifiedAt?'Cloudflare D1/R2 és védett szerveres visszaállítás ellenőrizve':'SQLite + teljes fájlellenőrzés; Cloudflare-visszaállítás még nincs igazolva'});
 }
 const match=path.match(/^\/api\/admin\/backups\/(\d+)\/download$/);
 if(!match)return reply({error:'Nem található.'},404);
 const a=await get(`/actions/artifacts/${match[1]}`);
 if(a.expired||!/^paraspots-backup-\d+-\d+$/.test(a.name)||!a.workflow_run?.id)return reply({error:'A mentés nem elérhető.'},404);
 const run=await get(`/actions/runs/${a.workflow_run.id}`);
 if(run.conclusion!=='success'||run.path!==workflow||run.head_branch!=='main')return reply({error:'A mentés ellenőrzése nem sikerült.'},409);
 const redirect=await fetcher(root+`/actions/artifacts/${match[1]}/zip`,{headers,redirect:'manual'});
 if(redirect.status!==302)return reply({error:'A mentés nem tölthető le.'},502);
 const location=new URL(redirect.headers.get('Location'));
 // Signed storage URL is issued by authenticated GitHub. Credentials are NOT forwarded.
 if(location.protocol!=='https:'||location.username||location.password)return reply({error:'Hibás letöltési cím.'},502);
 const file=await fetcher(location.toString(),{redirect:'manual'});
 if(!file.ok)return reply({error:'A tárhely nem érhető el.'},502);
 return new Response(file.body,{headers:{'Content-Type':'application/zip','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="paraspots-backup-${a.id}.zip"`}});
}
