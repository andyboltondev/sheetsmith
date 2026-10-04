import { wrapText } from './generator.js';
export async function appendClassSpells(PDFLib,doc,form,font,spells,resource,clean,slots=[]){
 const source=await PDFLib.PDFDocument.load(resource.bytes);
 const effect=resource.layout.find(f=>f.name==='SpellSheet1_Spell Effect 01');
 const cards=[];
 for(const s of spells){const lines=wrapText(clean([s.components.length>22?'Components: '+s.components:'',s.summary,s.restriction,s.reference].filter(Boolean).join('\n')),font,6,effect.rect[2]-effect.rect[0]-8);
  const capacity=Math.floor((effect.rect[3]-effect.rect[1]-10)/7.2)-1;
  for(let i=0;i<lines.length;i+=capacity)cards.push({...s,name:s.name+(i?' (cont.)':''),effect:lines.slice(i,i+capacity).join('\n')});
 }
 for(let offset=0;offset<cards.length;offset+=12){
  const [page]=await doc.copyPages(source,[0]);doc.addPage(page);
  const values={'SpellSheet 1_Cantrips Known':spells.filter(s=>s.level===0).length,'SpellSheet 1_Spells Known':spells.filter(s=>s.level>0).length};
  const attack=[...new Set(spells.map(s=>s.attackBonus).filter(v=>v!=null))],dc=[...new Set(spells.map(s=>s.saveDC).filter(v=>v!=null))];
  if(attack.length===1)values['SpellSheet 1_Spell Atk']=attack[0]>=0?'+'+attack[0]:String(attack[0]);
  if(dc.length===1)values['SpellSheet 1_Spell DC']=dc[0];
  cards.slice(offset,offset+12).forEach((s,i)=>{const n=String(i+1).padStart(2,'0');
   const put=(key,v)=>values[`${key} ${n}`]=v;
   put('SpellSheet1_Ritual',s.ritual);put('SpellSheet1_Concentration',s.concentration);put('SpellSheet1_Prepared',s.prepared);
   for(const [label,component] of [['Verbal','V'],['Somatic','S'],['Material','M']])put('SpellSheet1_'+label,new RegExp('(^|[^A-Za-z])'+component+'([^A-Za-z]|$)').test(s.components));
   put('SpellSheet1_Spell Name',s.name);put('SpellSheet 1_Spells Level',s.level===0?'0':s.level);put('SpellSheet1_Spell School',s.school);put('SpellSheet1_Range',s.range);put('SpellSheet1_Casting Time',s.casting);put('SpellSheet1_Save',s.requiresSave?`${s.savingThrow} ${s.saveDC??'?'}`:s.requiresAttack&&s.attackBonus!=null?`${s.attackBonus>=0?'+':''}${s.attackBonus} atk`:'');put('SpellSheet1_Duration',s.duration+(s.concentration?' (C)':''));put('SpellSheet1_Components',(s.components.length>22?'See effect':s.components)+(s.ritual?' / Ritual':''));put('SpellSheet1_Component',s.components.length>22?'See effect':s.components);put('SpellSheet1_Spell Effect',s.effect);
  });
  for(const f of resource.layout){
   const slotMatch=f.name.match(/Spell Slot (\d)(?:st|nd|rd|th) (\d)/);
   if(slotMatch&&f.type==='/Btn'){
    const slot=slots.find(s=>s.level===Number(slotMatch[1]));
    if(slot&&Number(slotMatch[2])<=slot.total)values[f.name]=slot.used!=null&&Number(slotMatch[2])<=slot.used;
   }
   if(f.type==='/Btn'&&Object.hasOwn(values,f.name)){
    const [x,y,r,t]=f.rect,width=r-x,height=t-y;
    const check=form.createCheckBox(`Spellbook${doc.getPageCount()}.${f.name}`);
    check.acroField.dict.set(PDFLib.PDFName.of('TU'),PDFLib.PDFHexString.fromText(f.name.replace('SpellSheet1_','')+(slotMatch?' used':'')));
    check.addToPage(page,{x,y,width,height,borderWidth:0,backgroundColor:undefined,borderColor:undefined});
    if(values[f.name])check.check();
    check.updateAppearances(()=>({normal:{on:PDFLib.drawCheckMark({x:width/2,y:height/2,size:Math.min(width,height)/2,thickness:1,color:PDFLib.rgb(0,0,0)}),off:[]}}));
    continue;
   }
   if(!Object.hasOwn(values,f.name)||f.type!=='/Tx')continue;const [x,y,r,t]=f.rect;
   const value=clean(values[f.name]),field=form.createTextField(`Spellbook${doc.getPageCount()}.${f.name}`);
   field.acroField.dict.set(PDFLib.PDFName.of('TU'),PDFLib.PDFHexString.fromText(f.name.replace(/SpellSheet.?_?/g,'Spell ')));
   const multi=/Effect|Components? \d/.test(f.name);if(multi)field.enableMultiline();
   field.setText(multi?wrapText(value,font,6,r-x-8).join('\n'):value);
   const paddingY=t-y<12?0:2;
   const height=t-y-2*paddingY;
   field.addToPage(page,{x:x+2,y:y+paddingY,width:r-x-4,height,font,borderWidth:0,backgroundColor:undefined,borderColor:undefined});
   const maximum=/School/.test(f.name)?6:9;
   field.setFontSize(multi?6:Math.min(maximum,(r-x-7)/Math.max(1,font.widthOfTextAtSize(value||' ',1)),(height-2)/font.heightAtSize(1,{descender:false})));
  }
 }
}
