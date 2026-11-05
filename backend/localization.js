// Additive JSON schema: legacy fields remain the canonical German source.
export const languages = ['de', 'en', 'hu'];
export const textFields = new Set(['name','description','difficulty','windSensitivity','approachDescription','parking']);
export function translatable(key, value) { return textFields.has(key) && (value == null || typeof value === 'string'); }
export function migrateContent(value) {
 if (Array.isArray(value)) return value.map(migrateContent);
 if (!value || typeof value !== 'object') return value;
 const out = {};
 for (const [key,v] of Object.entries(value)) if(key !== 'translations') out[key] = migrateContent(v);
 const fields = Object.keys(value).filter(k=>translatable(k,value[k]));
 if (fields.length || value.translations) {
  out.translations = structuredClone(value.translations || {});
  for(const lang of languages) out.translations[lang] ??= {};
  // German stays in legacy fields; duplicate only for explicit language editing.
  for(const key of fields) out.translations.de[key] = value[key] ?? '';
 }
 return out;
}
export function localizedContent(value, lang) {
 if(Array.isArray(value)) return value.map(v=>localizedContent(v,lang));
 if(!value || typeof value !== 'object') return value;
 const out = {};
 for(const [key,v] of Object.entries(value)) {
  if(key === 'translations') {out[key]=structuredClone(v);continue;}
  const translated = value.translations?.[lang]?.[key];
  out[key] = translatable(key,v) && typeof translated==='string' && translated.trim() ? translated : localizedContent(v,lang);
 }
 return out;
}
export function translationErrors(value, path='') {
 const errors=[];
 if(Array.isArray(value)) return value.flatMap((v,i)=>translationErrors(v,`${path}[${i}]`));
 if(!value || typeof value!=='object') return errors;
 if(value.translations!=null) {
  const t=value.translations;
  if(typeof t!=='object'||Array.isArray(t)) return [`${path}.translations: objektum szükséges.`];
  for(const [lang,fields] of Object.entries(t)) {
   if(!languages.includes(lang)||!fields||typeof fields!=='object'||Array.isArray(fields)){errors.push(`${path}.translations: DE/EN/HU szövegmezők szükségesek.`);continue;}
   for(const [key,text] of Object.entries(fields)) {
    if(!textFields.has(key)||typeof text!=='string'||!(key in value)||!translatable(key,value[key])) errors.push(`${path}.translations.${lang}.${key}: nem fordítható mező vagy hibás szöveg.`);
    if(lang==='de' && text !== (value[key]??'')) errors.push(`${path}.${key}: a német és az alapmező eltér.`);
   }
  }
 }
 for(const [key,v] of Object.entries(value)) if(key!=='translations')errors.push(...translationErrors(v,`${path}.${key}`));
 return errors;
}
export function missingTranslations(value,path='') {
 if(Array.isArray(value)) return value.flatMap((v,i)=>missingTranslations(v,`${path}[${i+1}]`));
 if(!value || typeof value!=='object')return [];
 const missing=[];
 for(const [key,v] of Object.entries(value)) {
  if(key==='translations')continue;
  if(translatable(key,v)&&typeof v==='string'&&v.trim())for(const lang of ['en','hu'])if(!value.translations?.[lang]?.[key]?.trim())missing.push(`${path?path+'.':''}${key}: ${lang.toUpperCase()} hiányzik → német tartalom.`);
  missing.push(...missingTranslations(v,`${path?path+'.':''}${key}`));
 }
 return missing;
}
