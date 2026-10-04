import { coinLine, displayItems, lineHeight, wrapText } from './generator.js';
const groups={strength:['Athletics'],dexterity:['Acrobatics','Sleight of Hand','Stealth'],constitution:[],intelligence:['Arcana','History','Investigation','Nature','Religion'],wisdom:['Animal Handling','Insight','Medicine','Perception','Survival'],charisma:['Deception','Intimidation','Performance','Persuasion']};
const signed=n=>n>=0?`+${n}`:String(n);
export async function generateGroupedPdf(PDFLib,c,options){
 const {PDFDocument,StandardFonts,rgb,PDFName,PDFHexString}=PDFLib;
 const doc=await PDFDocument.create();doc.setLanguage('en-GB');
 const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),serif=await doc.embedFont(StandardFonts.TimesRomanBold),form=doc.getForm(),warnings=[];
 const ink=rgb(.13,.15,.14),muted=rgb(.34,.36,.34),line=rgb(.65,.67,.63);
 const clean=v=>[...String(v??'')].map(ch=>{if(ch==='\n')return ch;try{font.encodeText(ch);return ch;}catch{if(!warnings.length)warnings.push('Some unsupported characters were replaced with ?.');return '?';}}).join('');
 const text=(p,v,x,y,size=10,f=font)=>p.drawText(clean(v),{x,y,size,font:f,color:ink});
 const box=(p,x,y,w,h)=>p.drawRectangle({x,y,width:w,height:h,borderColor:line,borderWidth:.6,color:rgb(.99,.99,.975)});
 const field=(p,name,value,x,y,w,h,size=10,multi=false,center=false)=>{
  const f=form.createTextField(name);f.acroField.dict.set(PDFName.of('TU'),PDFHexString.fromText(name.replaceAll('.',' ')));
  if(multi)f.enableMultiline();f.setText(clean(value));f.addToPage(p,{x,y,width:w,height:h,font,borderWidth:0,backgroundColor:undefined,borderColor:undefined});f.setFontSize(size);if(center)f.setAlignment(PDFLib.TextAlignment.Center);return f;
 };
 const page=title=>{const p=doc.addPage([595.28,841.89]);text(p,'FIELD NOTES  /  5e (2014)',36,802,9,bold);text(p,title,36,770,26,serif);p.drawLine({start:{x:36,y:757},end:{x:559,y:757},thickness:1,color:line});text(p,c.identity.name,36,27,9);return p;};
 const centeredLabel=(p,label,x,y,w,size=8)=>text(p,label,x+(w-font.widthOfTextAtSize(clean(label),size))/2,y,size);
 const p=page('Character record');
 field(p,'CharacterName',c.identity.name,36,715,523,32,22);
 const identity=[c.identity.species,...c.classes.map(v=>`${v.name} ${v.level}${v.subclass?' / '+v.subclass:''}`),c.identity.background,c.identity.alignment?'Alignment: '+c.identity.alignment:''].filter(Boolean).join('  •  ');
 field(p,'Identity',wrapText(clean(identity),font,10,519).join('\n'),36,682,523,32,10,true);
 const stats=[['AC',c.combat.armourClass],['MAX HP',c.combat.maxHP],['SPEED (ft)',c.combat.speed],['INITIATIVE',signed(c.combat.initiative)],['PROFICIENCY',signed(c.proficiencyBonus)],['PASSIVE',c.passivePerception]];
 stats.forEach(([label,value],i)=>{const x=36+i*88;box(p,x,620,83,53);centeredLabel(p,label,x,658,83);field(p,label,value,x+6,626,71,28,20,false,true);});
 Object.entries(groups).forEach(([ability,skills],i)=>{
  const x=36+(i%2)*267,y=438-Math.floor(i/2)*163,w=256;
  box(p,x,y,w,153);text(p,ability.toUpperCase(),x+10,y+132,11,bold);
  const a=c.abilities[ability],order=options.abilityOrder==='modifier-first'?['modifier','score']:['score','modifier'];
  order.forEach((kind,j)=>{const yy=y+74-j*51;centeredLabel(p,kind.toUpperCase(),x+9,yy+29,45,7.5);field(p,`${ability}.${kind}`,kind==='modifier'?signed(a[kind]):a[kind],x+9,yy,45,28,22,false,true);});
  const save=c.saves.find(s=>s.name===ability);
  const rows=[{name:'Saving throw',...save},...skills.map(name=>c.skills.find(s=>s.name===name)).filter(Boolean)];
  rows.forEach((r,j)=>{const yy=y+110-j*19;field(p,`${ability}.${j===0?'saving throw':r.name}`,`${r.expertise?'E':r.proficient?'P':'-'} ${signed(r.bonus??0)}  ${j===0?'Saving throw':r.name}`,x+66,yy-4,182,18,9.5);});
 });
 text(p,'P = proficient   E = expertise   - = not proficient',36,97,8);
 const trackers=[['CURRENT HP',c.combat.currentHP],['TEMP HP',c.combat.temporaryHP],['HIT DICE',c.combat.hitDice],['DEATH SAVES','Success: ___  Fail: ___']];
 trackers.forEach(([label,value],i)=>{const x=36+i*132;box(p,x,43,127,43);centeredLabel(p,label,x,73,127);field(p,label,value,x+5,48,117,22,i===3?8:12,false,true);});
 let sheet=page('Abilities & equipment'),y=738,serial=0;
 const section=(title,body)=>{
  const lines=wrapText(clean(body),font,10,499);if(!lines.some(Boolean))return;
  // Keep short sections whole: move them to a new page rather than split a few lines off.
  const lh=lineHeight(font,10),need=lines.length*lh+40;
  if(need>y-60&&need<660){sheet=page('Character details');y=738;}
  let offset=0;
  while(offset<lines.length){
   if(y<125){sheet=page('Character details');y=738;}
   const capacity=Math.max(1,Math.floor((y-90)/lh));const count=Math.min(capacity,lines.length-offset);const h=count*lh+6;
   text(sheet,title+(offset?' / continued':''),36,y-10,11.5,bold);
   field(sheet,`Details.${++serial}.${title}`,lines.slice(offset,offset+count).join('\n'),40,y-16-h,515,h,10,true);
   y-=h+34;offset+=count;
  }
 };
 section('Resources',[c.experience!=null?'XP: '+c.experience:'',c.inspiration?'Inspiration: Yes':'',c.combat.hitDiceUsed!=null?'Hit dice used: '+c.combat.hitDiceUsed:'',...(c.featureUses??[]).map(u=>`${u.name}: ${u.remaining}/${u.maximum} uses remaining`)].filter(Boolean).join('\n'));
 section('Proficiencies & languages',[c.proficiencies&&`Armour, weapons & tools: ${c.proficiencies}`,c.languages&&`Languages: ${c.languages}`].filter(Boolean).join('\n'));
 if(c.featureRows?.length){for(const f of c.featureRows)section(f.name,`${f.summary}${f.reference?'\n'+f.reference:''}`);}else section('Features & traits',c.features);
 if(c.weapons?.length)section('Weapons',c.weapons.map(w=>`${w.name}${w.equipped?' (equipped)':''}: ${w.attackBonus==null?'check attack':'base attack '+signed(w.attackBonus)}; ${w.damage}. ${w.notes}`).join('\n\n'));
 section('Equipment & currency',[displayItems(c.equipment),coinLine(c.coins)].filter(Boolean).join('\n\n'));
 const d=c.details??{};
 section('Identity & personality',[options.playerName||c.identity.playerName?`Player: ${options.playerName||c.identity.playerName}`:'',...Object.entries(d).filter(([k])=>!['backstory','allies'].includes(k)).map(([k,v])=>v?`${k.replace(/([A-Z])/g,' $1')}: ${v}`:'')].filter(Boolean).join('\n'));
 section('Background',d.backstory);section('Allies',d.allies);
 if(options.portrait){if(y<230){sheet=page('Character portrait');y=738;}const image=await doc.embedPng(options.portrait),scale=Math.min(200/image.width,200/image.height);sheet.drawImage(image,{x:36,y:y-210,width:image.width*scale,height:image.height*scale});}
 if(c.spells||c.spellRows?.length||c.spellSlots?.length){sheet=page('Spellbook');y=738;
  if(c.spellSlots?.length)section('Spell slots',c.spellSlots.map(s=>`Level ${s.level}: ${s.total} total${s.used==null?'':'; '+s.used+' used'}`).join('\n'));
  if(c.spellRows?.length){for(const s of c.spellRows){section(`${s.name} / ${s.level===0?'Cantrip':'Level '+s.level}${s.prepared?' / Prepared':''}`,[`${s.casting} • ${s.range} • ${s.duration}${s.concentration?' • Concentration':''}${s.ritual?' • Ritual':''}`,`Components: ${s.components}`,s.summary,s.restriction,s.reference].filter(Boolean).join('\n'));}}
  else section('Spells',c.spells);
 }
 doc.getPages().forEach((p,i)=>text(p,`${i+1} / ${doc.getPageCount()}`,521,27,9));
 form.updateFieldAppearances(font);doc.setTitle(`${clean(c.identity.name)} — Field Notes — 5e (2014)`);
 return {bytes:await doc.save(),warnings};
}
