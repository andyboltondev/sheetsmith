import { M, RIGHT, A4, BOTTOM, preparers, signed } from './compact-kit.js';
import { fitText, lineHeight, ordinal, wrapText } from './generator.js';
// Cantrips and spells: a stat line per spell with its description beneath, plus slots and the casting summary.
export function drawSpells(ctx){
 const {p,c,options,kit,overflow}=ctx; const {PDFLib,doc,form,fields,warnings,font,bold,ink,muted,hair,accent,tint,white,clean,width,text,label,centred,rightLabel,rule,vrule,rbox,named,unique,field,dot,diamond,heading,ruled}=kit;
 const spells=c.spellRows??[];
 if(spells.length||c.spellSlots?.length){
  const STOP=782,SW=RIGHT-M,preparer=c.classes.some(v=>preparers.has(v.name));let sp=null,sy=0;
  const newPage=cont=>{sp=doc.addPage(A4);text(sp,'Cantrips & spells'+(cont?' (continued)':''),M,800,13,bold,accent);const n=clean(c.identity.name);text(sp,n,RIGHT-width(n,7.5),801,7.5,font,muted);rule(sp,M,RIGHT,792,accent,1.2);sy=STOP;};
  newPage(false);
  const atk=[...new Set(spells.map(s=>s.attackBonus).filter(v=>v!=null))],dc=[...new Set(spells.map(s=>s.saveDC).filter(v=>v!=null))],ability=[...new Set(spells.map(s=>s.ability).filter(Boolean))];
  const stats=[['Spellcasting ability',ability.join(' / '),'SpellAbility'],['Spell save DC',dc.length===1?dc[0]:'','SpellSaveDC'],['Spell attack bonus',atk.length===1?signed(atk[0]):'','SpellAttack']],sw=SW/3;
  rbox(sp,M,sy-20,SW,20);
  stats.forEach(([n,v,id],i)=>{const x=M+i*sw;if(i)vrule(sp,x,sy-16,sy-4);label(sp,n,x+8,sy-12.5,6);field(sp,id,v,x+sw-60,sy-17,54,15,{size:11,align:'center',f:bold});});
  {const key=[spells.some(s=>s.concentration)&&'C concentration',spells.some(s=>s.ritual)&&'R ritual',spells.some(s=>s.level>0)&&'filled = prepared'].filter(Boolean).join(' · ');if(key)rightLabel(sp,key,RIGHT,sy-28,6);}
  sy-=36;
  const cols={name:M+11,time:M+142,range:M+194,hit:M+248,dmg:M+294,dur:M+384,comp:M+470};
  const colEnd={name:cols.time,time:cols.range,range:cols.hit,hit:cols.dmg,dmg:cols.dur,dur:cols.comp,comp:RIGHT};
  const slotsFor=l=>c.spellSlots?.find(v=>v.level===l);
  const groupBar=(lvl,cont)=>{
   rbox(sp,M,sy-13,SW,13,{fill:tint,border:undefined,r:2});
   const title=(lvl===0?'Cantrips':`${ordinal(lvl)} level`)+(cont?' (continued)':'');label(sp,title,M+5,sy-9,6.5,accent);
   const slot=slotsFor(lvl);
   if(slot&&!cont){const n=Math.min(slot.total,9);rightLabel(sp,'slots',RIGHT-5,sy-9,6);for(let i=0;i<n;i++)dot(sp,`Slots.${lvl}.${i+1}`,RIGHT-36-(n-1-i)*9,sy-6.5,slot.used!=null&&i<slot.used,2.8);}
   sy-=17;
   [['Spell','name'],['Time','time'],['Range','range'],['Hit / DC','hit'],['Damage','dmg'],['Duration','dur'],['Comp.','comp']].forEach(([n,k])=>label(sp,n,cols[k],sy-4,6));
   sy-=8;rule(sp,M,RIGHT,sy,hair,.5);
  };
  const lh7=lineHeight(font,7.2);
  const byLevel=Object.groupBy([...spells].sort((a,b)=>a.level-b.level),s=>s.level);for(const s of c.spellSlots??[])byLevel[s.level]??=[];
  for(const [lvlKey,list] of Object.entries(byLevel).sort((a,b)=>a[0]-b[0])){
   const lvl=Number(lvlKey);
   if(sy-BOTTOM<90)newPage(true);
   groupBar(lvl,false);
   for(const s of list){
    const n=named(s.name),letters=(s.components.match(/\b[VSM]\b/g)||[]).join(', ')||s.components,materials=s.components.length>10?`Components: ${s.components}.`:'';
    const body=clean([s.school&&`${s.school}${s.ritual?' (ritual)':''}.`,materials,s.summary,s.restriction].filter(Boolean).join(' '));
    let lines=wrapText(body,font,7.2,SW-42),room=Math.floor((sy-BOTTOM-24)/lh7),rest='';
    if(lines.length>room&&room<Math.min(lines.length,6)){newPage(true);groupBar(lvl,true);room=Math.floor((sy-BOTTOM-24)/lh7);}
    if(lines.length>room){const fit=fitText(body,font,{width:SW-42,height:room*lh7,max:7.2,min:6.6,marker:'(Continued overleaf)'});lines=wrapText(fit.text,font,fit.size||7.2,SW-42);rest=fit.rest;}
    const refH=s.reference?8:0,nh=lines.length*lh7+3,y=sy-13;
    if(s.level>0)dot(sp,`Spell.${n}.prepared`,M+4,y+5.5,c.blanked?.spells?false:c.preparedChosen||preparer?!!s.prepared:true,2.4);
    // Concentration and ritual are marked with small tags after the name.
    const tags=[s.concentration&&'C',s.ritual&&'R'].filter(Boolean);
    tags.forEach((t,k)=>{const tx=cols.time-5-(tags.length-k)*10;rbox(sp,tx,y+2,8,8,{fill:accent,border:undefined,r:2});text(sp,t,tx+2.4,y+4,6,bold,white);});
    field(sp,`Spell.${n}.name`,s.name,cols.name,y,cols.time-cols.name-3-tags.length*10,12,{size:8.2,f:bold});
    field(sp,`Spell.${n}.time`,s.casting,cols.time,y,colEnd.time-cols.time-3,12,{size:7.2});
    field(sp,`Spell.${n}.range`,s.range,cols.range,y,colEnd.range-cols.range-3,12,{size:7.2});
    field(sp,`Spell.${n}.hit`,s.requiresSave?`${s.savingThrow} ${s.saveDC??''}`.trim():s.requiresAttack&&s.attackBonus!=null?signed(s.attackBonus):'',cols.hit,y,colEnd.hit-cols.hit-3,12,{size:7.2});
    field(sp,`Spell.${n}.damage`,s.damage??'',cols.dmg,y,colEnd.dmg-cols.dmg-3,12,{size:7.2});
    field(sp,`Spell.${n}.duration`,s.duration.replace(/^Concentration, up to /i,''),cols.dur,y,colEnd.dur-cols.dur-3,12,{size:7.2});
    field(sp,`Spell.${n}.components`,letters,cols.comp,y,colEnd.comp-cols.comp,12,{size:7.2});
    // Components that cost gold or are used up are flagged so they are not missed.
    {const cost=s.components.match(/(\d[\d,]*)\s*(gp|sp|cp|ep|pp)\b/i),used=/consum/i.test(s.components),flag=cost?`${cost[1]}${cost[2].toLowerCase()}`:used?'consumed':'';
     if(flag){const fw=width(flag,6,bold)+5,fx=cols.comp+width(letters,7.2)+4;rbox(sp,fx,y+2,fw,8,{fill:accent,border:undefined,r:2});text(sp,flag,fx+2.5,y+4.2,6,bold,white);}}
    label(sp,'Notes',M+11,y-8.5,6);field(sp,`Spell.${n}.effect`,lines.join('\n'),M+38,y-nh,SW-38,nh,{size:7.2,multi:true});
    if(s.reference){const r=clean(s.reference);text(sp,r,RIGHT-width(r,6),y-nh-6.5,6,font,muted);}
    sy=y-nh-refH-3;rule(sp,M,RIGHT,sy,hair,.4);sy-=2;
    if(rest)overflow.push([`${s.name} (continued)`,rest]);
   }
   sy-=8;
  }
  // The details pages carry on from here if the page has room left.
  ctx.tail={page:sp,y:sy};
 }
}
