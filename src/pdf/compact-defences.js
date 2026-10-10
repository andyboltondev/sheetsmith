import { M, RIGHT, signed } from './compact-kit.js';
import { wrapText, lineHeight } from './generator.js';
// Training, languages and defences as plain text, shared by page one and the features page.
export function proficiencyText(c){
 const def=c.defences??{},list=(n,v)=>v?.length?`${n}: ${v.join(', ')}`:'',pg=c.proficiencyGroups;
 const training=pg?[list('Armour',pg.armour),list('Weapons',pg.weapons),list('Tools',pg.tools)]:[c.proficiencies&&`Armour, weapons & tools: ${c.proficiencies}`];
 const profs=[...training,c.languages&&`Languages: ${c.languages}`].filter(Boolean).join('\n');
 const defence=[list('Senses',c.senses),list('Speeds',c.speeds),list('Resistances',def.resistances),list('Immunities',def.immunities),list('Vulnerabilities',def.vulnerabilities),list('Saving throws',def.saveNotes)].filter(Boolean).join('\n');
 return {def,training,defence};
}
const RX=M,RW=RIGHT-M;
// One-line summary of what applies right now, below the abilities. Returns the y below it.
export function drawDefences(ctx,y){
 const {p,c,options,kit,overflow}=ctx; const {PDFLib,doc,form,fields,warnings,font,bold,ink,muted,hair,accent,tint,white,clean,width,text,label,centred,rightLabel,rule,vrule,rbox,named,unique,field,dot,diamond,heading,ruled}=kit;
 const {def}=proficiencyText(c);
 let ry=y;
 // What applies right now: senses, resistances and conditional saves in one short line.
 {const cap=t=>String(t).replace(/\b[a-z]/g,m=>m.toUpperCase()),short=t=>String(t).replace(/\.$/,'');
  const save=t=>{const m=String(t).match(/^(Advantage|Disadvantage) on saving throws\s*(?:against|vs\.?)?\s*(.*)$/i);return m?`${/^adv/i.test(m[1])?'Adv.':'Disadv.'} ${m[2]?`vs ${cap(m[2])} Saves`:'on Saves'}`:short(t);};
  const parts=[...(c.senses??[]).map(short),...(def.resistances??[]).map(r=>`${cap(r)} Resistance`),...(def.immunities??[]).map(r=>`${cap(r)} Immunity`),...(def.vulnerabilities??[]).map(r=>`${cap(r)} Vulnerability`),...(def.saveNotes??[]).map(save)].filter(Boolean);
  if(parts.length){const text1=clean(parts.join('  ·  ')),lw0=width('SENSES & DEFENCES',6,bold)+14,lines=wrapText(text1,font,7.4,RW-lw0-12),h=Math.max(16,Math.min(3,lines.length)*lineHeight(font,7.4)+7);
   rbox(p,RX,ry-h,RW,h,{});label(p,'Senses & defences',RX+7,ry-h/2-2,6,accent);
   field(p,'SensesDefences',lines.slice(0,3).join('\n'),RX+lw0+8,ry-h+2,RW-lw0-8,h-4,{size:7.4,multi:true});ry-=h+16;}}
 return ry;
}
