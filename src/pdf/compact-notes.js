import { M, RIGHT, A4, BOTTOM } from './compact-kit.js';
// A notes block fills whatever is left at the foot of the last page (or opens its own page when little is left),
// then any extra note pages the player asked for.
const TOP=782,MIN=90;
// Lowest edge of anything editable on a page: where the content above the notes ends.
function lowestField(PDFLib,doc,page){
 let low=TOP;
 for(const ref of page.node.Annots()?.asArray()??[]){
  const rect=doc.context.lookupMaybe(ref,PDFLib.PDFDict)?.lookupMaybe(PDFLib.PDFName.of('Rect'),PDFLib.PDFArray);
  if(rect)low=Math.min(low,rect.lookup(1,PDFLib.PDFNumber).asNumber());
 }
 return low;
}
export function drawNotes(ctx){
 const {p,c,options,kit}=ctx,{PDFLib,doc,font,bold,muted,accent,width,text,rule,field,heading,ruled,clean}=kit;
 const pages=doc.getPages(),last=pages[pages.length-1];
 const notes=(page,top,id)=>{field(page,id,'',M-2,BOTTOM,RIGHT-M+4,top-BOTTOM,{multi:true});ruled(page,M,RIGHT-M,top);};
 const fresh=id=>{
  const pg=doc.addPage(A4),name=clean(c.identity.name);
  text(pg,'Notes',M,800,13,bold,accent);text(pg,name,RIGHT-width(name,7.5),801,7.5,font,muted);rule(pg,M,RIGHT,792,accent,1.2);
  notes(pg,TOP,id);
 };
 // Page one is full, so a sheet with no further pages gets a notes page instead.
 const lowest=pages.length>1?lowestField(PDFLib,doc,last):BOTTOM,top=lowest-16;
 if(top-BOTTOM>=MIN){heading(last,'Notes',M,top,RIGHT-M);notes(last,top-4,'Notes');}
 else fresh('Notes');
 const extra=Math.max(0,Math.min(10,Math.floor(Number(options.notePages)||0)));
 for(let i=0;i<extra;i++)fresh(`Notes ${i+2}`);
}
