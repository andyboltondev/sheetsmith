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
  // Continuation pages reuse the sheet's own artwork, so only the sheet and (for casters) its spell page are needed.
  if(!selected.generated){
   const [main,spellResource]=await Promise.all([asset(selected.id),character.spellRows?.length?asset(`${selected.family}-spells`):undefined]);
   prepared={...prepared,templateBytes:main.bytes,layout:main.layout,spellResource};
  }
  const result=await generatePdf(PDFLib,character,prepared);
  self.postMessage({result},[result.bytes.buffer]);
 }catch(error){self.postMessage({error:error.message||'Could not generate your PDF. Please try again.'});}
};
