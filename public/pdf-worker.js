import * as PDFLib from '/pdf-lib.js';
import { generatePdf } from '/pdf/generator.js';
import { resolveTemplate } from '/pdf/selection.js';
import { prepareOfficial } from '/pdf/official.js';
// Only field layouts come from the server; the official PDFs themselves are the user's own, already checksum-verified files.
async function layoutOf(id){
  const response=await fetch(`/templates/${encodeURIComponent(id)}.json`,{signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw new Error('The selected template could not be loaded. Please try again.');
  return response.json();
}
self.onmessage=async({data})=>{
 try{
  const {character,options:{catalog:supplied,officialFiles,...options}}=data;
  // The page already holds the catalogue; fetch it only when started without one.
  let catalog=supplied;
  if(!catalog){
   const response=await fetch('/api/templates',{signal:AbortSignal.timeout(30_000)});
   if(!response.ok)throw new Error('Could not load character sheet styles.');
   catalog=await response.json();
  }
  const selected=resolveTemplate(catalog,character,options.templateId);
  let prepared={...options,templateId:selected.id};
  // Continuation pages reuse the sheet's own artwork, so only the sheet and (for casters) its spell page are needed.
  if(!selected.generated){
   const [sheets,layout,spellLayout]=await Promise.all([prepareOfficial(PDFLib,officialFiles,selected.id),layoutOf(selected.id),character.spellRows?.length?layoutOf('official-spells'):undefined]);
   prepared={...prepared,templateBytes:sheets.main,layout,spellResource:spellLayout&&{bytes:sheets.spells,layout:spellLayout}};
  }
  const result=await generatePdf(PDFLib,character,prepared);
  self.postMessage({result},[result.bytes.buffer]);
 }catch(error){self.postMessage({error:error.message||'Could not generate your PDF. Please try again.'});}
};
