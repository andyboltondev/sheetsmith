import {templatePdf,layoutOf} from './helpers/templates.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import {sourceReference,gameplay} from '../src/importers/dndbeyond/gameplay.ts';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser JS
import {resolveTemplate} from '../src/pdf/selection.js';
// @ts-expect-error Browser JS
import {generatePdf} from '../src/pdf/generator.js';
const catalog=JSON.parse(await readFile(new URL('../templates/catalog.json',import.meta.url),'utf8'));
test('only SheetSmith and the two official styles can be chosen',()=>{
 assert.equal(resolveTemplate(catalog,{},'compact').generated,true);
 for(const id of ['official-standard','official-alternative'])assert.equal(resolveTemplate(catalog,{},id).id,id);
 assert.equal(resolveTemplate(catalog,{}).id,'official-standard');
 for(const id of ['class','class-fighter','official-spells','nonsense'])assert.throws(()=>resolveTemplate(catalog,{classes:[{name:'Fighter'}]},id),/Choose one of the available/,id);
 assert.ok(catalog.every((t:any)=>t.edition==='5e'&&!t.characterClass),'no third-party class sheets are catalogued');
});
test('book pages require explicit page metadata and cite the PHB for Basic Rules entries',()=>{
 assert.equal(sourceReference({sources:[{sourceId:2,pageNumber:242}]}),'PHB (2014), p. 242');
 // D&D Beyond numbers Basic Rules entries by PHB page.
 assert.equal(sourceReference({sources:[{sourceId:1,pageNumber:20}]}),'PHB (2014), p. 20');
 assert.equal(sourceReference({sources:[{sourceId:1}]}),'');
 assert.equal(sourceReference({sources:[{sourceId:2}]}),'');
 assert.equal(sourceReference({isHomebrew:true,sources:[{sourceId:2,pageNumber:1}]}),'Homebrew');
});
test('grouped custom PDF keeps scores, saves and skills together and retains long content',async()=>{
 const c=normalise(JSON.parse(await readFile(new URL('../src/sample/martial.json',import.meta.url),'utf8')));
 c.featureRows=Array.from({length:40},(_,i)=>({name:`Feature ${i}`,summary:'A useful rule for gameplay. '.repeat(8),reference:'',group:'Class',level:1}));
 const {bytes}=await generatePdf(PDFLib,c,{templateId:'compact',abilityOrder:'modifier-first'});
 const doc=await PDFLib.PDFDocument.load(bytes),form=doc.getForm();
 assert.equal(form.getTextField('strength.modifier').getText(),'+3');
 assert.equal(form.getTextField('strength.score').getText(),'16');
 assert.equal(form.getTextField('strength.save').getText(),'+'+(c.saves.find(s=>s.name==='strength')!.bonus));
 assert.equal(form.getTextField('strength.Athletics').getText(),'+'+(c.skills.find(s=>s.name==='Athletics')!.bonus));
 assert.equal(form.getCheckBox('Proficient.strength.save').isChecked(),c.saves.find(s=>s.name==='strength')!.proficient);
 assert.equal(form.getCheckBox('Proficient.strength.Athletics').isChecked(),c.skills.find(s=>s.name==='Athletics')!.proficient);
 assert.ok(form.getTextField('strength.modifier').acroField.getWidgets()[0].getRectangle().y>form.getTextField('strength.score').acroField.getWidgets()[0].getRectangle().y);
 assert.ok(form.getFields().some(f=>f.getName().includes('Feature 39')));
});
test('every class exports on both official styles and SheetSmith with all six abilities',async()=>{
 const c=normalise(JSON.parse(await readFile(new URL('../src/sample/martial.json',import.meta.url),'utf8')));
 for(const name of ['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard','Blood Hunter']){
  const character={...c,classes:[{name,level:3}]};
  for(const id of ['official-standard','official-alternative','compact']){
   const {bytes}=await generatePdf(PDFLib,character,id==='compact'?{templateId:id}:{templateId:id,templateBytes:await templatePdf(id),layout:await layoutOf(id)});
   const doc=await PDFLib.PDFDocument.load(bytes);
   for(const ability of Object.keys(c.abilities))assert.ok(doc.getForm().getTextField(`${ability}.score`),`${name} ${id}`);
  }
 }
});
import {plainText} from '../src/importers/dndbeyond/text.ts';
test('rich text removes markup, decodes entities and preserves useful paragraph and list boundaries',()=>{
 assert.equal(plainText('<p><strong>Shield</strong> &amp; sword</p><ul><li>+5 AC</li><li>Don&#39;t lose &#x32; HP.</li></ul>'),"Shield & sword\n\n• +5 AC\n\n• Don't lose 2 HP.");
 assert.equal(plainText('&lt;p&gt;A &ldquo;quoted&rdquo; note&lt;/p&gt;'),'A “quoted” note');
 assert.equal(plainText('<script>alert(1)</script><style>body{}</style><p>Safe <a href="https://example.com?a=>">rules</a></p>'),'Safe rules');
 assert.equal(plainText('Roll < 10; bonus > 2.'),'Roll < 10; bonus > 2.');
});
test('HTML cleanup covers identity, notes, traits, items, features and spells',async()=>{
 const raw=JSON.parse(await readFile(new URL('../src/sample/martial.json',import.meta.url),'utf8'));
 raw.data.name='<b>Mara</b>';raw.data.notes={backstory:'<p>A &amp; B</p><p>Next chapter</p>'};raw.data.traits={ideals:'<i>Truth</i>'};
 raw.data.inventory=[{quantity:1,definition:{name:'<strong>Sword</strong>'}}];
 const c=normalise(raw);assert.equal(c.identity.name,'Mara');assert.equal(c.details?.backstory,'A & B\n\nNext chapter');assert.equal(c.details?.ideals,'Truth');assert.match(c.equipment,/1 x Sword/);
});
