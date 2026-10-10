import { M, RIGHT, A4, BOTTOM, plural, titleCase } from './compact-kit.js';
import { lineHeight, fitText, wrapText } from './generator.js';
import { PROFICIENCY_ONLY } from './format.js';
import { proficiencyText } from './compact-defences.js';
// Detail pages: a two-column flow of headed sections for features, magic items, personality and notes.
export function drawDetails(ctx){
 const {p,c,options,kit,overflow}=ctx; const {PDFLib,doc,form,fields,warnings,font,bold,ink,muted,hair,accent,tint,white,clean,width,text,label,centred,rightLabel,rule,vrule,rbox,named,unique,field,dot,diamond,heading,ruled}=kit;
 const spells=c.spellRows??[];
 const {training,defence}=proficiencyText(c);
 const COLW=(RIGHT-M-16)/2,TOP=782,size=8,lh=lineHeight(font,size);
 let page=null,col=0,y=0,serial=0;
 const header=title=>{const pg=doc.addPage(A4);text(pg,title,M,800,13,bold,accent);const n=clean(c.identity.name);text(pg,n,RIGHT-width(n,7.5),801,7.5,font,muted);rule(pg,M,RIGHT,792,accent,1.2);return pg;};
 const next=title=>{if(page&&col===0){col=1;y=page===bandPage?bandY:TOP;return;}page=header(title);col=0;y=TOP;};
 // A new part starts in a spare column of the current page when there is one, under its own title.
 const start=title=>{
  if(page&&(col===0||y-BOTTOM>(TOP-BOTTOM)*.45)){if(col===0){col=1;y=page===bandPage?bandY:TOP;}else y-=8;text(page,title,x(),y-11,11,bold,accent);y-=22;return;}
  page=null;next(title);};
 const x=()=>M+col*(COLW+16);
 let flowed=false;
 const section=(title,body,pageTitle,ref='')=>{
  const lines=wrapText(clean(String(body??'').trim()),font,size,COLW-4);if(!lines.some(Boolean))return;flowed=true;
  // Keep short sections whole rather than strand a heading or a couple of lines.
  const need=lines.length*lh+18;if(need>y-BOTTOM&&need<TOP-BOTTOM)next(pageTitle);else if(y-BOTTOM<36)next(pageTitle);
  let offset=0;
  while(offset<lines.length){
   if(y-BOTTOM<36)next(pageTitle);
   const count=Math.min(Math.max(1,Math.floor((y-BOTTOM-14)/lh)),lines.length-offset),h=count*lh+3;
   text(page,title+(offset?' (continued)':''),x(),y-8,8.5,bold);
   if(ref&&!offset){const r=clean(ref);text(page,r,x()+COLW-width(r,6),y-8,6,font,muted);}
   rule(page,x(),x()+COLW,y-11,hair,.4);
   field(page,`Details.${++serial}.${named(title)}`,lines.slice(offset,offset+count).join('\n'),x()-2,y-13-h,COLW+4,h,{size,multi:true});
   y-=h+19;offset+=count;
  }
 };
 const group=(name,pageTitle,note='')=>{flowed=true;if(y-BOTTOM<64)next(pageTitle);rbox(page,x(),y-13,COLW,13,{fill:tint,border:undefined,r:2});label(page,name,x()+5,y-9,6.5,accent);if(note)rightLabel(page,note,x()+COLW-5,y-9,6);y-=20;};
 // Proficiencies, languages and defences head the features page in three columns.
 const bandCols=[['Proficiencies',training.filter(Boolean).join('\n'),'Proficiencies'],['Languages',c.languages??'','Languages'],['Senses & defences',defence,'Defences']].filter(v=>v[1]);
 let bandPage=null,bandY=0;
 const d=c.details??{},personal=['personalityTraits','ideals','bonds','flaws'];
 const physical=['gender','age','size','height','weight','eyes','skin','hair','faith','lifestyle'],tableKeys=['gender','age','size','height','weight','eyes','skin','hair','faith','lifestyle'];
 const physicalValue=k=>k==='weight'&&/^\d+(\.\d+)?$/.test(String(d[k]).trim())?`${d[k]} lb`:d[k];
 const detailNotes=Object.entries(d).filter(([k,v])=>v&&!personal.includes(k));
 if(c.featureRows?.length||c.features||overflow.length||detailNotes.length||personal.some(k=>d[k])||bandCols.length||tableKeys.some(k=>d[k])){
  // Features follow on from the spells when that page has room left, rather than opening a fresh page.
  const tail=ctx.tail&&ctx.tail.y-BOTTOM>200?ctx.tail:null;
  if(tail){page=tail.page;col=0;y=tail.y-6;text(page,'Features & notes',M,y-11,11,bold,accent);y-=26;bandPage=page;bandY=y;}else start('Features & notes');
  // Appearance at a glance: a table of short fields across the top of the page.
  if(tableKeys.some(k=>d[k])){const keys=tableKeys.filter(k=>d[k]),per=keys.length<=5?keys.length:Math.ceil(keys.length/2),cw=(RIGHT-M-(per-1)*8)/per;heading(page,'Appearance',M,y,RIGHT-M);y-=8;
   keys.forEach((k,i)=>{const x=M+(i%per)*(cw+8),top=y-Math.floor(i/per)*30;rbox(page,x,top-24,cw,24,{});label(page,titleCase(k),x+5,top-8,6);
    field(page,`Appearance.${titleCase(k)}`,d[k]?String(physicalValue(k)):'',x+3,top-22,cw-6,13,{size:9});});
   y-=Math.ceil(keys.length/per)*30+16;bandPage=page;bandY=y;}
  if(bandCols.length){const bw=(RIGHT-M-16*(bandCols.length-1))/bandCols.length,bsize=7.6,blh=lineHeight(font,bsize);
   const parts=bandCols.map(([t,b,id])=>({t,id,text:clean(b),lines:wrapText(clean(b),font,bsize,bw-4)})),bh=Math.min(150,Math.max(...parts.map(v=>v.lines.length))*blh+4);
   parts.forEach((v,i)=>{const x=M+i*(bw+16);heading(page,v.t,x,y,bw);
    const fit=v.lines.length*blh+4>bh?fitText(v.text,font,{width:bw-4,height:bh-4,max:bsize,min:6.5}):{text:v.lines.join('\n'),size:bsize};
    field(page,v.id,fit.text,x-2,y-6-bh,bw+4,bh,{size:fit.size,multi:true});if(fit.rest)overflow.push([`${v.t} (continued)`,fit.rest]);});
   y-=bh+22;bandPage=page;bandY=y;}
  if(c.featureRows?.length)for(const [g,fs] of Object.entries(Object.groupBy(c.featureRows,f=>f.group||'Features'))){
   // Traits whose only effect is a proficiency share one entry; the proficiency lists carry the rule.
   const covered=fs.filter(f=>f.summary===PROFICIENCY_ONLY),shown=fs.filter(f=>!covered.includes(f)),refs=[...new Set(covered.map(f=>f.reference).filter(Boolean))];
   group(g,'Features & notes',plural(shown.length+(covered.length?1:0),'entry','entries'));
   for(const f of shown)section(f.name,f.summary,'Features & notes',f.reference);
   if(covered.length)section('Proficiency traits',`${covered.map(f=>f.name).join(' · ')}. Included in the proficiency lists.`,'Features & notes',refs.join('; '));}
  else section('Features & traits',c.features,'Features & notes');
  const magic=(c.inventoryRows??[]).filter(r=>r.magic);
  if(magic.length){group('Magic items','Features & notes',plural(magic.length,'item'));for(const r of magic)section(r.name,r.summary,'Features & notes',[r.rarity,r.attunement?(r.attuned?'attuned':'requires attunement'):''].filter(Boolean).join(', '));}
  for(const [t,b] of overflow)section(t,b,'Features & notes');
  // The Character heading spans both columns and governs everything beneath it; it starts a fresh page once features have been laid out.
  if(detailNotes.length||personal.some(k=>d[k])||d.appearance||physical.some(k=>d[k]&&!tableKeys.includes(k))){
   // After features, Character continues in the free space of the same page when a useful amount is left; otherwise it starts a fresh page.
   const inline=flowed&&page&&(col===0||y-BOTTOM>(TOP-BOTTOM)*.3);
   if(flowed&&!inline){page=null;next('Character');}
   if(inline){if(col===0){col=1;y=page===bandPage?bandY:TOP;}else y-=6;rbox(page,x(),y-13,COLW,13,{fill:tint,border:undefined,r:2});label(page,'Character',x()+5,y-9,6.5,accent);y-=20;}
   else{rbox(page,M,y-13,RIGHT-M,13,{fill:tint,border:undefined,r:2});label(page,'Character',M+5,y-9,6.5,accent);rightLabel(page,'personality · appearance · background · notes',RIGHT-5,y-9,6);
    y-=20;col=0;bandPage=page;bandY=y;}
   for(const k of personal)section(titleCase(k),d[k],'Character');
   section('Appearance',[physical.filter(k=>d[k]&&!tableKeys.includes(k)).map(k=>`${titleCase(k)}: ${physicalValue(k)}`).join('  ·  '),d.appearance].filter(Boolean).join('\n\n'),'Character');
   // Personality and appearance fill the left column; the longer notes follow in the right.
   if(!inline&&col===0&&y<bandY){col=1;y=bandY;}
   const order=['allies','personalPossessions','otherHoldings','organizations','enemies','backstory','otherNotes'],names={backstory:'Background',organizations:'Organisations',personalPossessions:'Personal Possessions',otherHoldings:'Other Holdings',otherNotes:'Other Notes'};
   const rank=k=>order.includes(k)?order.indexOf(k):order.length;
   for(const [k,v] of [...detailNotes].sort((x,y)=>rank(x[0])-rank(y[0])))if(![...physical,'appearance'].includes(k))section(names[k]??titleCase(k),v,'Character');}
 }
 if(c.spells&&!spells.length){start('Spellbook');section('Spells',c.spells,'Spellbook');}
}
