import { savePdf } from './generator.js';
import { A4, createKit } from './compact-kit.js';
import { drawHeader } from './compact-header.js';
import { drawAbilities } from './compact-abilities.js';
import { drawDefences } from './compact-defences.js';
import { drawAttacks } from './compact-attacks.js';
import { drawActions } from './compact-actions.js';
import { drawEquipment } from './compact-equipment.js';
import { drawSpells } from './compact-spells.js';
import { drawDetails } from './compact-details.js';
// SheetSmith (template id 'compact'): a minimal one-page summary (abilities, saves and skills in one table with proficiency dots),
// followed by compact two-column detail and spellbook pages. Everything stays editable.
// Each section draws into a shared context and reports where it ended; text that does not fit is queued in `overflow`
// for the detail pages.
export async function generateGroupedPdf(PDFLib,c,options){
 const doc=await PDFLib.PDFDocument.create();doc.setLanguage('en-GB');
 const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica),bold=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
 const kit=createKit(PDFLib,doc,font,bold),ctx={p:doc.addPage(A4),c,options,kit,overflow:[]};
 await drawHeader(ctx);
 const abilitiesEnd=drawAbilities(ctx);
 let y=drawDefences(ctx,abilitiesEnd);
 y=drawAttacks(ctx,y);
 y=drawActions(ctx,y);
 drawEquipment(ctx,Math.min(abilitiesEnd,y));
 drawSpells(ctx);
 drawDetails(ctx);
 // Footer numbers keep loose pages in order; they are on unless turned off.
 if(options.pageNumbers!==false){const pages=doc.getPages();pages.forEach((pg,i)=>{const t=`Page ${i+1} of ${pages.length}`;kit.text(pg,t,(A4[0]-kit.width(t,7))/2,20,7,kit.font,kit.muted);});}
 doc.setTitle(`${kit.clean(c.identity.name)} — SheetSmith — 5e (2014)`);
 return {bytes:await savePdf(PDFLib,doc,kit.form,font),warnings:kit.warnings};
}
