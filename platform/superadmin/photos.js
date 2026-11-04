// Re-encode in-browser: correct phone orientation, resize and omit original EXIF/GPS.
export async function preparePhoto(file){
 if(file.size>40*1024*1024)throw Error('Legfeljebb 40 MB-os eredeti képet válassz.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;
  try{await image.decode();}catch{throw Error('Ez a kép nem olvasható. JPEG, PNG vagy WebP formátumban próbáld újra (HEIC képet exportálj JPEG-ként).');}
  if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>100000000)throw Error('Túl nagy képfelbontás. Válassz kisebb képet.');
  const scale=Math.min(1,2000/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
  if(!blob||blob.size>8*1024*1024)throw Error('A kép nem tömöríthető megfelelően. Válassz kisebb képet.');
  return blob;
 }finally{URL.revokeObjectURL(url);}
}
