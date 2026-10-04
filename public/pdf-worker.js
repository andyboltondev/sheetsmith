import * as PDFLib from '/pdf-lib.js';
import { generatePdf } from '/pdf/generator.js';
import { resolveTemplate } from '/pdf/selection.js';
async function asset(id){
  const encoded=encodeURIComponent(id);
  const [pdf,layout]=await Promise.all(['pdf','json'].map(ext=>fetch(`/templates/${encoded}.${ext}`,{signal:AbortSignal.timeout(30_000)})));
  if(!pdf.ok||!layout.ok)throw new Error('The selected template could not be loaded. Please try again.');
  return {bytes:new Uint8Array(await pdf.arrayBuffer()),layout:await layout.json()};
}
self.onmessage=async({data})=>{
 try{
  const {character,options}=data;
  const response=await fetch('/api/templates',{signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw new Error('Could not load character sheet styles.');
  const selected=resolveTemplate(await response.json(),character,options.templateId);
  let prepared={...options,templateId:selected.id};
  if(!selected.generated){
   const [main,reference]=await Promise.all([asset(selected.id),asset(`${selected.family}-reference`)]);
   prepared={...prepared,templateBytes:main.bytes,layout:main.layout,reference};
   if(selected.family==='class'&&character.spellRows?.length)prepared.spellResource=await asset('class-spells');
  }
  const result=await generatePdf(PDFLib,character,prepared);
  self.postMessage({result},[result.bytes.buffer]);
 }catch(error){self.postMessage({error:error.message||'Could not generate your PDF. Please try again.'});}
};
