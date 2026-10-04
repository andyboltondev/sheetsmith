import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as P from 'pdf-lib';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser module
import {fitText,generatePdf,lineHeight} from '../src/pdf/generator.js';
const fixture=async()=>normalise(JSON.parse(await readFile(new URL('./fixtures/martial.json',import.meta.url),'utf8')));
const asset=async(id:string)=>({bytes:await readFile(new URL(`../templates/${id}.pdf`,import.meta.url)),layout:JSON.parse(await readFile(new URL(`../templates/${id}.json`,import.meta.url),'utf8'))});
// Continuation pages need only the sheet itself; spellcasters also get the family's spell page.
const options=async(id:string)=>{const main=await asset(id);return {templateId:id,templateBytes:main.bytes,layout:main.layout,spellResource:await asset(id.startsWith('class-')?'class-spells':'official-spells')};};
const spell=(i:number)=>({name:`Spell ${i}`,level:i%4,school:'Evocation',casting:'Action',range:'60 ft',duration:'Instantaneous',components:'V, S',summary:'An effect. '.repeat(30),reference:'',prepared:true,ritual:false,concentration:false,requiresSave:false,requiresAttack:true,attackBonus:5,saveDC:13,savingThrow:'',restriction:''});
const objects=(doc:P.PDFDocument)=>{
 const {context}=doc,reachable=new Set<P.PDFRef>(),pending:unknown[]=[context.trailerInfo.Root,context.trailerInfo.Info];
 while(pending.length){let v=pending.pop();if(v instanceof P.PDFRef){if(reachable.has(v))continue;reachable.add(v);v=context.lookup(v);}
  if(v instanceof P.PDFStream)v=v.dict;if(v instanceof P.PDFDict)pending.push(...v.values());else if(v instanceof P.PDFArray)pending.push(...v.asArray());}
 const all=context.enumerateIndirectObjects();
 return {orphans:all.filter(([ref])=>!reachable.has(ref)).length,images:all.filter(([,o])=>o instanceof P.PDFRawStream&&o.dict.get(P.PDFName.of('Subtype'))===P.PDFName.of('Image')).length};
};
test('class exports store each page image once, even with several spell-card and continuation pages',async()=>{
 const c=await fixture();c.classes=[{name:'Wizard',level:9}];c.spellRows=Array.from({length:26},(_,i)=>spell(i));
 c.details={...c.details,backstory:'A long story. '.repeat(400)};
 const {bytes}=await generatePdf(P,c,await options('class-wizard')),doc=await P.PDFDocument.load(bytes);
 assert.ok(doc.getPageCount()>=6,'two spell-card pages and continuations');
 // Front, back and spell-card artwork; continuation and extra spell pages draw the same images.
 assert.deepEqual(objects(doc),{orphans:0,images:3});
});
test('every style saves without unreferenced objects and needs no separate reference template',async()=>{
 const c=await fixture();c.spellRows=[spell(1)];c.details={...c.details,otherNotes:'Notes. '.repeat(500)};
 for(const id of ['official-standard','official-alternative','class-fighter','compact']){
  const {bytes}=await generatePdf(P,c,id==='compact'?{templateId:id}:await options(id)),doc=await P.PDFDocument.load(bytes);
  assert.equal(objects(doc).orphans,0,id);
  const text=doc.getForm().getFields().filter(f=>f instanceof P.PDFTextField).map(f=>(f as P.PDFTextField).getText()??'').join('\n');
  assert.ok(text.includes('Notes. Notes.'),`${id} keeps long notes`);
 }
});
test('repeated or dotted spell, action and feature names still export on every style',async()=>{
 const c=await fixture();c.spellRows=[spell(0),{...spell(0),restriction:'High Elf cantrip'},{...spell(1),name:'Dr. Wondrous Bolt.'}];
 c.actions=[{name:'Second Wind',activation:'Bonus action',summary:'Heal.'},{name:'Second Wind',activation:'Bonus action',summary:'Heal again.'}];
 c.featureUses=[{name:'Second Wind',remaining:1,maximum:1},{name:'Second Wind',remaining:0,maximum:1}];
 c.featureRows=[{name:'Lucky.',summary:'Reroll.',reference:'',group:'Feats',level:0},{name:'Lucky.',summary:'Reroll again.',reference:'',group:'Feats',level:0}];
 for(const id of ['compact','official-standard','class-fighter']){
  const {bytes}=await generatePdf(P,c,id==='compact'?{templateId:id}:await options(id));
  assert.ok(bytes.length>1000,id);
 }
});
test('magic items fill the class equipment slots, item boxes and attunement circles, and the official features panel',async()=>{
 const c=await fixture();
 const item=(name:string,attuned:boolean,summary:string)=>({name,quantity:1,equipped:true,category:'Wondrous item',armourType:null,weight:1,attuned,magic:true,rarity:'Rare',attunement:true,summary});
 c.inventoryRows=[{name:'Chain Mail',quantity:1,equipped:true,category:'Armor',armourType:3,weight:55},item('Cloak of Protection',true,'+1 to AC and saving throws.'),item('Ring of Protection',false,'+1 to AC and saving throws.'),item('Ring of Warmth',true,'Resistance to cold damage.')];
 let doc=await P.PDFDocument.load((await generatePdf(P,c,await options('class-fighter'))).bytes),form=doc.getForm();
 const text=(n:string)=>form.getTextField(n).getText()??'',checked=(n:string)=>form.getCheckBox(n).isChecked();
 assert.deepEqual(['Back_Cloak','Back_Ring1','Back_Ring2','Back_Armour'].map(text),['Cloak of Protection','Ring of Protection','Ring of Warmth','Chain Mail']);
 assert.deepEqual([checked('Attune_Cloak'),checked('Attune_Ring1'),checked('Attune_Ring2')],[true,false,true]);
 // Attuned items lead the item boxes.
 assert.deepEqual([text('Back_Item Name 01'),text('Back_Item Effect 01'),text('Back_Item Name 03')],['Cloak of Protection','+1 to AC and saving throws.','Ring of Protection']);
 assert.ok(checked('Attune_Item 01')&&!checked('Attune_Item 03'));
 doc=await P.PDFDocument.load((await generatePdf(P,c,await options('official-standard'))).bytes);form=doc.getForm();
 assert.match(text('Feat+Traits'),/MAGIC ITEMS\nCloak of Protection \(Rare, attuned\): \+1 to AC[\s\S]*Ring of Protection \(Rare, requires attunement\)/);
 doc=await P.PDFDocument.load((await generatePdf(P,c,{templateId:'compact'})).bytes);form=doc.getForm();
 assert.ok(form.getFields().some(f=>/^Details\.\d+\.Ring of Warmth$/.test(f.getName())),'Compact lists magic items with the features');
});
test('a heading that would end a full box moves on with its text',async()=>{
 const doc=await P.PDFDocument.create(),font=await doc.embedFont(P.StandardFonts.Helvetica);
 const text=`First\nSecond\nThird\n\nSPELL DETAILS\n${'Long spell text. '.repeat(20)}`,box={width:200,height:lineHeight(font,7)*6,max:7,min:7,marker:'(more)'};
 assert.match(fitText(text,font,box).text,/SPELL DETAILS\n\(more\)$/,'without the hint the heading is stranded');
 const fit=fitText(text,font,{...box,isHeading:(line:string)=>line==='SPELL DETAILS'});
 assert.equal(fit.text,'First\nSecond\nThird\n(more)');
 assert.match(fit.rest,/^SPELL DETAILS\nLong spell text\./);
});
test('photo portraits embed as JPEG on every style',async()=>{
 const c=await fixture(),portrait=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAGAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCuAmBL/9k=','base64');
 for(const id of ['compact','official-standard','class-fighter']){
  const {bytes}=await generatePdf(P,c,{...(id==='compact'?{templateId:id}:await options(id)),portrait}),doc=await P.PDFDocument.load(bytes);
  const filters=doc.context.enumerateIndirectObjects().map(([,o])=>o instanceof P.PDFRawStream&&o.dict.get(P.PDFName.of('Subtype'))===P.PDFName.of('Image')?String(o.dict.get(P.PDFName.of('Filter'))):'').filter(Boolean);
  assert.ok(filters.includes('/DCTDecode')&&objects(doc).images===filters.length,id);
 }
});
