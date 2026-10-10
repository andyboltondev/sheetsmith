import {templatePdf,layoutOf} from './helpers/templates.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser-compatible JS
import {generatePdf} from '../src/pdf/generator.js';
async function sample(){
 const raw=JSON.parse(await readFile(new URL('../src/sample/martial.json',import.meta.url),'utf8'));
 raw.data.inventory=[{quantity:1,equipped:true,definition:{name:'Warhammer',filterType:'Weapon',type:'Warhammer',categoryId:2,attackType:1,damage:{diceString:'1d8'},damageType:'Bludgeoning',range:5,properties:[]}},{quantity:1,equipped:true,definition:{name:'Chain Mail',filterType:'Armor',armorTypeId:3,armorClass:16}},{quantity:20,equipped:false,definition:{name:'Bolts',filterType:'Other Gear'}}];
 raw.data.modifiers.class.push({type:'proficiency',subType:'martial-weapons',friendlySubtypeName:'Martial Weapons'});
 raw.data.classes[0].id=123;raw.data.classes[0].subclassDefinition={name:'Eldritch Knight',spellCastingAbilityId:4};
 raw.data.classSpells=[{characterClassId:123,spells:[{definition:{id:10,name:'Fire Bolt',level:0,requiresAttackRoll:true,description:'Ranged spell attack: 1d10 fire damage.',sources:[{sourceId:2,pageNumber:242}]}},{definition:{id:11,name:'Shield',level:1,description:'+5 AC until start of your next turn.'}}]}];
 return normalise(raw);
}
test('weapons and inventory retain quantities, equipped state and basic rolls',async()=>{
 const c=await sample();assert.equal(c.weapons?.[0].name,'Warhammer');assert.equal(c.weapons?.[0].attackBonus,c.abilities.strength.modifier+c.proficiencyBonus);assert.match(c.weapons![0].damage,/1d8 \+3 Bludgeoning/);assert.equal(c.inventoryRows?.[2].quantity,20);assert.equal(c.spellRows?.[0].attackBonus,c.abilities.intelligence.modifier+c.proficiencyBonus);
});
for(const id of ['official-standard','official-alternative','compact'])test(`${id}: weapons, spells and gear survive export in their visible sections`,async()=>{
 const c=await sample();let options:any={templateId:id};
 if(id!=='compact')options={...options,templateBytes:await templatePdf(id),layout:(await layoutOf(id))};
 const {bytes}=await generatePdf(PDFLib,c,options);const doc=await PDFLib.PDFDocument.load(bytes),form=doc.getForm();
 const content=form.getFields().filter(f=>f instanceof PDFLib.PDFTextField).map(f=>(id==='compact'?f.getName()+' ': '')+(f as PDFLib.PDFTextField).getText()).join('\n');
 for(const text of ['Warhammer','Fire Bolt','Shield','Chain Mail',id==='compact'?'Bolts':'20 × Bolts'])assert.ok(content.includes(text),text);
 if(id==='compact')assert.match(content,/Item\.\d+\.Qty 20/);
 if(id!=='compact')assert.equal(form.getTextField('Wpn Name').getText(),'Warhammer');
});
test('turning equipment weights off removes item weights and carry totals from the official sheet and Compact',async()=>{
 const c=await sample();c.inventoryRows!.forEach(r=>{r.weight=5;});c.carrying={weight:15,capacity:240,pushDragLift:480};
 for(const id of ['official-standard','compact']){
  const on:any=id==='compact'?{templateId:id}:{templateId:id,templateBytes:await templatePdf(id),layout:(await layoutOf(id))};
  const text=async(options:any)=>{const form=(await PDFLib.PDFDocument.load((await generatePdf(PDFLib,c,options)).bytes)).getForm();return form.getFields().filter(f=>f instanceof PDFLib.PDFTextField).map(f=>(f as PDFLib.PDFTextField).getText()).join('\n');};
  assert.match(await text(on),/\d lb/,id+' shows weights by default');
  assert.doesNotMatch(await text({...on,equipmentWeight:false}),/\d lb|Carried \d|capacity \d/i,id+' leaves weights off');
 }
});
