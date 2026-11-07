import {memberListPanel} from '/clubadmin/member-list.js';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(name,title,value='',type='text',extra='')=>`<label>${esc(title)}<input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;
let selected='001',pending=false;
async function api(path='',method='GET',body) {
  const r=await fetch('/api/club'+path+'?mode=super&club='+encodeURIComponent(selected),{
    method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,
  });
  const data=await r.json();
  if(!r.ok)throw new Error(r.status===401?'Jelentkezz be újra a Superadmin felületén.':data.error||'A kérés nem sikerült.');
  // Do not let a club-admin session impersonate this Superadmin view.
  if(method==='GET' && data.superuser!==true)throw new Error('Superadmin-jogosultság szükséges.');
  return data;
}
async function load() {
  const model=await api();
  $('member-club').innerHTML=model.clubs.map(c=>`<option value="${esc(c.id)}" ${c.id===model.club.id?'selected':''}>${esc(c.name)} · ${esc(c.id)}</option>`).join('');
  selected=model.club.id;
  $('member-list').innerHTML=memberListPanel(model,{esc,field});
}
async function operation(work) {
  if(pending)return;
  pending=true;$('member-club').disabled=true;$('member-list').inert=true;
  $('member-status').textContent='Betöltés…';
  try {await work();$('member-status').textContent='';}
  catch(e){$('member-list').replaceChildren();$('member-status').textContent=e.message;}
  finally{pending=false;$('member-club').disabled=false;$('member-list').inert=false;}
}
$('open-members').onclick=()=>{
  $('member-area').hidden=false;
  $('member-area').scrollIntoView({behavior:'smooth',block:'start'});
  operation(load);
};
$('close-members').onclick=()=>{$('member-area').hidden=true;};
$('member-club').onchange=e=>{
  selected=e.target.value;$('member-list').replaceChildren();operation(load);
};
$('member-list').onsubmit=e=>{
  e.preventDefault();const form=e.target,action=form.dataset.save;
  if(!['member-add','member-remove'].includes(action))return;
  const email=new FormData(form).get('email');
  operation(async()=>{await api('/members',action==='member-add'?'PUT':'DELETE',{email});await load();});
};
