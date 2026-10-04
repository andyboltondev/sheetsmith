import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import {gameplayText} from '../src/importers/dndbeyond/concise.ts';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser-compatible JS
import {generatePdf} from '../src/pdf/generator.js';
test('PHB-backed summaries retain play rules and remove explicit upgrades only',()=>{
 const rules='One action. CON save: 2d8 damage; half on success.\nAt Higher Levels. Add 1d8 for each higher slot.';
 assert.equal(gameplayText(rules,'PHB (2014), p. 282',3),'One action. CON save: 2d8 damage; half on success.');
 assert.equal(gameplayText(rules,'',3),rules);
 assert.equal(gameplayText('One use per short rest. At 18th level, use this twice.','PHB (2014), p. 72',3),'One use per short rest.');
 assert.match(gameplayText('Deal 1d10 damage.\nCantrip Upgrade\nAt 5th level, deal 2d10 damage.','PHB (2014), p. 242',5),/2d10/);
});
test('source-defined current subclass features and compact spells remain identifiable',async()=>{
 const raw=JSON.parse(await readFile(new URL('./fixtures/martial.json',import.meta.url),'utf8'));
 raw.data.classes[0].subclassDefinition={name:'Eldritch Knight',classFeatures:[{id:77}]};
 raw.data.classes[0].classFeatures=[{definition:{id:77,name:'Weapon Bond',requiredLevel:3,snippet:'Bonus action: summon your bonded weapon.',sources:[{sourceId:2,pageNumber:75}]}},{definition:{id:78,name:'Future Feature',requiredLevel:18,snippet:'Not yet available.'}}];
 raw.data.classSpells=[{spells:[{definition:{id:1,name:'Magic Missile',level:1,sources:[{sourceId:2,pageNumber:257}],description:'Full details.'}}]}];
 const c=normalise(raw);assert.equal(c.featureRows?.[0].group,'Subclass features');assert.ok(!c.features.includes('Future Feature'));assert.match(c.spells,/1d4 \+ 1/);assert.match(c.spells,/p. 257/);assert.ok(!c.spells.includes('per slot level'));
});
test('every class layout maps available subclass panels and keeps proficiency categories out of tools',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../templates/catalog.json',import.meta.url),'utf8'));
 const base=normalise(JSON.parse(await readFile(new URL('./fixtures/martial.json',import.meta.url),'utf8')));
 for(const t of catalog.filter((v:any)=>v.characterClass)){
  const layout=JSON.parse(await readFile(new URL(`../templates/${t.id}.json`,import.meta.url),'utf8'));
  const panel=layout.find((f:any)=>f.page===0&&f.type==='/Tx'&&f.rect[3]-f.rect[1]>30&&/(?:Archetype|Feature|Oath|Origin|Patron|Tradition) \d+(?:-Arc\d+)?$/.test(f.name));
  const level=panel?Number(panel.name.match(/ (\d+)(?:-Arc\d+)?$/)[1]):3;
  const c={...base,classes:[{name:t.characterClass,level}],proficiencies:'Light Armor, Martial Weapons, Smith’s Tools',featureRows:[{name:'Current feature',summary:'Bonus action; one use per short rest.',reference:'PHB (2014), p. 75',group:'Subclass features',level}]};
  const {bytes}=await generatePdf(PDFLib,c,{templateId:t.id,layout,templateBytes:await readFile(new URL(`../templates/${t.id}.pdf`,import.meta.url))});
  const form=(await PDFLib.PDFDocument.load(bytes)).getForm();
  if(panel){assert.match(form.getTextField(panel.name).getText()!,/Current feature/,t.id);assert.ok(!form.getTextField('Back_Additional Features & Traits').getText()?.includes('Current feature'),t.id);}
  else assert.match(form.getTextField('Back_Additional Features & Traits').getText()!,/Current feature/,t.id);
  const light=layout.find((f:any)=>/^Front_Light Armour(?:-Arc\d+)?$/.test(f.name));if(light)assert.ok(form.getCheckBox(light.name).isChecked(),t.id);
  const tool=layout.find((f:any)=>/^Front_Tools(?:-Arc\d+)?$/.test(f.name));if(tool)assert.ok(!form.getTextField(tool.name).getText()?.includes('Light Armor'),t.id);
 }
});
