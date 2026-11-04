// Local filesystem adapter with the same API subset as Cloudflare R2.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export function photoBucket(directory){return {
 async put(key,bytes,{httpMetadata}){await mkdir(directory,{recursive:true});await writeFile(join(directory,key),bytes);await writeFile(join(directory,key+'.json'),JSON.stringify(httpMetadata));},
 async get(key){try{const bytes=await readFile(join(directory,key));const metadata=JSON.parse(await readFile(join(directory,key+'.json'),'utf8'));return {body:bytes,httpEtag:'"'+key+'"',writeHttpMetadata(headers){headers.set('Content-Type',metadata.contentType);}};}catch{return null;}}
};}
