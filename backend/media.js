// Immutable, same-origin photos. Uploads require the existing admin session.
export const photoPath=/^\/api\/media\/[a-f0-9]{64}\.(jpg|png|webp)$/;
const limit=8*1024*1024;
export async function uploadPhoto(request,bucket){
 if(!bucket)return Response.json({error:'A képtár még nincs bekapcsolva. Az adatok mentése továbbra is használható.'},{status:503});
 if(Number(request.headers.get('Content-Length'))>limit)return Response.json({error:'A kép legfeljebb 8 MB lehet.'},{status:413});
 const reader=request.body?.getReader(),chunks=[];let size=0;
 if(reader)while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return Response.json({error:'A kép legfeljebb 8 MB lehet.'},{status:413});}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const prefix=String.fromCharCode(...bytes.slice(0,12));
 const type=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':prefix.startsWith('\x89PNG\r\n\x1a\n')?'png':prefix.startsWith('RIFF')&&prefix.slice(8)==='WEBP'?'webp':null;
 if(!type)return Response.json({error:'JPEG, PNG vagy WebP képfájl szükséges.'},{status:415});
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const key=`${digest}.${type}`,contentType={jpg:'image/jpeg',png:'image/png',webp:'image/webp'}[type];
 await bucket.put(key,bytes,{httpMetadata:{contentType}});
 return Response.json({photo:`/api/media/${key}`},{headers:{'Cache-Control':'no-store'}});
}
export async function servePhoto(request,bucket,path){
 if(!bucket)return new Response('Képtár nem érhető el.',{status:503});
 const object=await bucket.get(path.slice('/api/media/'.length));
 if(!object)return new Response('Nincs ilyen kép.',{status:404});
 const headers=new Headers({'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Cross-Origin-Resource-Policy':'same-origin'});
 object.writeHttpMetadata(headers);headers.set('ETag',object.httpEtag);
 if(request.headers.get('If-None-Match')===object.httpEtag)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:object.body,{headers});
}
