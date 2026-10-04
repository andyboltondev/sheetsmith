import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as P from 'pdf-lib';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser module
import {generatePdf} from '../src/pdf/generator.js';
const fixture=async()=>JSON.parse(await readFile(new URL('./fixtures/martial.json',import.meta.url),'utf8'));
const asset=async(id:string)=>({bytes:await readFile(new URL(`../templates/${id}.pdf`,import.meta.url)),layout:JSON.parse(await readFile(new URL(`../templates/${id}.json`,import.meta.url),'utf8'))});
test('imports recorded resources and explicit class slot tables without guessing dynamic limits',async()=>{
 const raw=await fixture(),d=raw.data;
 d.currentXp=650;d.inspiration=true;d.removedHitPoints=7;d.temporaryHitPoints=3;d.classes[0].hitDiceUsed=2;
 d.classes[0].definition.spellRules={levelSpellSlots:[[],[],[],[],[],[4,2]]};
 d.spellSlots=[{level:1,used:1},{level:2,used:0}];
 d.actions={class:[{name:'Action Surge',limitedUse:{maxUses:1,numberUsed:0}},{name:'Unknown limit',limitedUse:{maxUses:1,numberUsed:0,useProficiencyBonus:true}}]};
 const c=normalise(raw);
 assert.equal(c.experience,650);assert.equal(c.inspiration,true);
 assert.equal(c.combat.currentHP,37);assert.equal(c.combat.temporaryHP,3);assert.equal(c.combat.hitDiceUsed,2);
 assert.deepEqual(c.spellSlots,[{level:1,total:4,used:1},{level:2,total:2,used:0}]);
 assert.deepEqual(c.featureUses,[{name:'Action Surge',maximum:1,remaining:1}]);
 d.classes[0].subclassDefinition={spellRules:{levelSpellSlots:[[],[],[],[],[],[3]]}};
 assert.equal(normalise(raw).spellSlots?.[0].total,3);
 d.classes.push({...d.classes[0],level:1});assert.deepEqual(normalise(raw).spellSlots,[]);
});
test('inherited base features remain class features when also present in the subclass list',async()=>{
 const raw=await fixture(),c=raw.data.classes[0];
 const base={id:1,name:'Second Wind',requiredLevel:1,description:'Recover hit points.'},sub={id:2,name:'Weapon Bond',requiredLevel:3,description:'Bond with a weapon.'};
 c.definition.classFeatures=[base];c.subclassDefinition={name:'Eldritch Knight',classFeatures:[base,sub]};c.classFeatures=[{definition:base},{definition:sub}];
 const rows=normalise(raw).featureRows!;
 assert.equal(rows.find(f=>f.name==='Second Wind')?.group,'Class features');
 assert.equal(rows.find(f=>f.name==='Weapon Bond')?.group,'Subclass features');
});
test('native families retain appearance, notes, holdings and numeric counters',async()=>{
 const raw=await fixture();raw.data.notes={allies:'Ally marker',organizations:'Organization marker',enemies:'Enemy marker',personalPossessions:'Possession marker',otherHoldings:'Holding marker',otherNotes:'Notes marker'};raw.data.traits.appearance='Appearance marker';raw.data.removedHitPoints=4;raw.data.temporaryHitPoints=2;
 const c=normalise(raw);c.featureUses=[{name:'Action Surge',remaining:1,maximum:1}];c.featureRows!.push({name:'Action Surge',summary:'Take an extra action.',reference:'PHB (2014), p. 72',group:'Class features',level:2});c.spellSlots=[{level:1,total:2,used:0}];
 for(const id of ['official-standard','official-alternative','class-fighter-eldritch-knight','field-notes']){
  const cls=id.startsWith('class-'),native=id!=='field-notes';const a=native?await asset(id):null;
  const options=a?{templateId:id,templateBytes:a.bytes,layout:a.layout,reference:await asset(cls?'class-reference':'official-reference')}:{templateId:id};
  const {bytes}=await generatePdf(P,c,options),doc=await P.PDFDocument.load(bytes),form=doc.getForm();
  const text=form.getFields().filter(f=>f instanceof P.PDFTextField).map(f=>(f as P.PDFTextField).getText()).join(' ');
  for(const marker of ['Ally','Organization','Enemy','Possession','Holding','Notes','Appearance'])assert.ok(text.includes(marker+' marker'),`${id}: ${marker}`);
  assert.match(text,/level 1: 2 total/i);
  if(cls){assert.equal(form.getTextField('Front_Inspiration-Arc2').getText()??'','');assert.equal(form.getTextField('Front_Action Surge-Arc2').getText(),'1');assert.equal(form.getTextField('Front_Current HP-Arc2').getText(),'40');assert.equal(form.getTextField('Front_Passive Insight-Arc2').getText(),'11');}
  else if(native)assert.equal(form.getTextField('HPCurrent').getText(),'40');
 }
});
test('spell-card school labels fit within their editable appearance bounds',async()=>{
 const c=normalise(await fixture());c.spellRows=[{name:'Test Spell',level:1,school:'Transmutation',casting:'1 action',range:'60 ft.',duration:'1 minute',components:'V, S',summary:'Gameplay effect.',reference:'',prepared:true,ritual:false,concentration:false,requiresSave:false,requiresAttack:false,attackBonus:null,saveDC:null,savingThrow:'',restriction:''}];
 c.spellSlots=[{level:1,total:2,used:1}];
 const a=await asset('class-fighter-eldritch-knight');const {bytes}=await generatePdf(P,c,{templateId:'class-fighter-eldritch-knight',templateBytes:a.bytes,layout:a.layout,spellResource:await asset('class-spells')});
 const d=await P.PDFDocument.load(bytes),font=await d.embedFont(P.StandardFonts.Helvetica);
 const f=d.getForm().getFields().find(f=>f.getName().includes('Spell School 01')) as P.PDFTextField;
 assert.equal(f.getText(),'Transmutation');
 const check=(suffix:string)=>d.getForm().getFields().find(f=>f.getName().endsWith(suffix)) as P.PDFCheckBox;
 assert.ok(check('SpellSheet1_Verbal 01').isChecked());assert.ok(check('SpellSheet1_Somatic 01').isChecked());assert.ok(!check('SpellSheet1_Material 01').isChecked());assert.ok(check('SpellSheet1_Prepared 01').isChecked());
 assert.ok(check('SpellSheet1_Spell Slot 1st 1').isChecked());assert.ok(!check('SpellSheet1_Spell Slot 1st 2').isChecked());
 const size=Number([...f.acroField.getDefaultAppearance()!.matchAll(/ ([0-9.]+) Tf/g)].at(-1)![1]);const rect=f.acroField.getWidgets()[0].getRectangle();
 assert.ok(font.heightAtSize(size,{descender:false})<=rect.height-2);assert.ok(font.widthOfTextAtSize(f.getText()!,size)<=rect.width-2);
});
