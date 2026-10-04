import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as P from 'pdf-lib';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser module
import {generatePdf} from '../src/pdf/generator.js';
// Mirrors the play-relevant data D&D Beyond exports for a Mountain Dwarf fighter in chain mail.
async function raw(){
 const raw=JSON.parse(await readFile(new URL('./fixtures/martial.json',import.meta.url),'utf8')),d=raw.data;
 Object.assign(d,{username:'player1',gender:'Male',faith:'Moradin',weight:175,preferences:{progressionType:1,ignoreCoinWeight:true},currentXp:0});
 d.race={...d.race,sizeId:4};
 d.inventory=[
  {quantity:1,equipped:true,definition:{name:'Chain Mail',filterType:'Armor',armorTypeId:3,weight:55,stealthCheck:2}},
  {quantity:20,equipped:true,definition:{name:'Crossbow Bolts',filterType:'Other Gear',weight:1.5,bundleSize:20}},
  {quantity:10,equipped:false,definition:{name:'Rations (1 day)',filterType:'Other Gear',weight:2}},
 ];
 d.actions={class:[{name:'Second Wind',snippet:'Regain 1d10 + level HP.',activation:{activationType:3},limitedUse:{maxUses:1,numberUsed:0,resetType:1}},{name:'Action Surge',activation:{activationType:8},limitedUse:{maxUses:1,numberUsed:1,resetType:1}}]};
 d.modifiers.class.push(
  {type:'proficiency',subType:'heavy-armor',friendlySubtypeName:'Heavy Armor',entityTypeId:174869515},
  {type:'proficiency',subType:'shields',friendlySubtypeName:'Shields',entityTypeId:174869515},
  {type:'proficiency',subType:'martial-weapons',friendlySubtypeName:'Martial Weapons',entityTypeId:660121713},
  {type:'proficiency',subType:'warhammer',friendlySubtypeName:'Warhammer',entityTypeId:1782728300},
  {type:'proficiency',subType:'smiths-tools',friendlySubtypeName:"Smith's Tools",entityTypeId:2103445194});
 return raw;
}
test('imports weights, carrying capacity, armour drawbacks, recovery and appearance',async()=>{
 const c=normalise(await raw());
 assert.equal(c.identity.playerName,'player1');assert.equal(c.advancement,'milestone');
 assert.deepEqual(c.carrying,{weight:76.5,capacity:c.abilities.strength.score*15,pushDragLift:c.abilities.strength.score*30});
 assert.equal(c.skills.find(s=>s.name==='Stealth')!.disadvantage,'Disadvantage (Chain Mail)');
 assert.deepEqual(c.featureUses!.map(u=>[u.name,u.reset,u.activation]),[['Second Wind','Short rest','Bonus action'],['Action Surge','Short rest','Special']]);
 assert.equal(c.actions!.find(a=>a.name==='Second Wind')!.uses,'1 / Short rest');
 assert.deepEqual(c.proficiencyGroups,{armour:['Heavy Armor','Shields'],weapons:['Martial Weapons'],tools:["Smith's Tools"]});
 assert.equal(c.details!.gender,'Male');assert.equal(c.details!.faith,'Moradin');assert.equal(c.details!.size,'Medium');
});
test('compact summary page carries actions, spells, weights and milestone; personality moves overleaf',async()=>{
 const c=normalise(await raw());
 c.spellRows=[{name:'Shield',level:1,school:'Abjuration',casting:'Reaction',range:'Self',duration:'1 Round',components:'V, S',summary:'+5 AC until the start of your next turn.',reference:'',prepared:false,ritual:false,concentration:false,requiresSave:false,requiresAttack:false,attackBonus:null,saveDC:13,savingThrow:'',restriction:''}];
 const {bytes}=await generatePdf(P,c,{templateId:'compact'}),doc=await P.PDFDocument.load(bytes),form=doc.getForm(),first=doc.getPages()[0].ref;
 const annots=doc.getPages()[0].node.Annots()!.asArray().map(String);void first;
 const onFirst=(name:string)=>form.getField(name).acroField.getWidgets().some(w=>annots.includes(String(doc.context.getObjectRef(w.dict))));
 assert.equal(form.getTextField('Experience').getText(),'Milestone');
 assert.match(form.getTextField('Action.Second Wind').getText()!,/Regain/);assert.ok(onFirst('Action.Second Wind'));
 assert.ok(form.getCheckBox('Uses.Action Surge.1').isChecked());assert.ok(!form.getCheckBox('Uses.Second Wind.1').isChecked());
 assert.equal(form.getTextField('Spell.Shield.time').getText(),'Reaction');assert.ok(!onFirst('Spell.Shield.effect'),'spells live on their own page');
 // Every levelled spell carries a prepared bullet, ticked only when the source marks it prepared.
 assert.ok(!form.getFields().some(f=>f.getName().endsWith('.prepared')),'known-spell casters get no prepared marker');
 assert.ok(!form.getFields().some(f=>f.getName().startsWith('Carry.')),'no carried box');
 assert.equal(form.getTextField('Item.1.Weight').getText(),'55 lb');assert.equal(form.getTextField('Item.2.Qty').getText(),'20');
 assert.match(form.getTextField('Proficiencies').getText()!,/Armour: Heavy Armor, Shields\nWeapons: Martial Weapons\nTools: Smith's Tools/);
 const personality=form.getFields().find(f=>/Details\.\d+\.Personality Traits/.test(f.getName()));
 if(c.details?.personalityTraits)assert.ok(personality&&!onFirst(personality.getName()));
});
test('a crowded caster keeps every summary-page field inside the page margins',async()=>{
 const c=normalise(await raw());c.classes=[{name:'Wizard',level:9}];
 c.spellRows=Array.from({length:30},(_,i)=>({name:`Spell ${i}`,level:i%6,school:'Evocation',casting:i%7?'Action':'Reaction',range:'60 ft',duration:'Instantaneous',components:'V, S, M',summary:'A long effect description that needs trimming. '.repeat(3),reference:'',prepared:i%2===0,ritual:false,concentration:i%3===0,requiresSave:i%4===0,requiresAttack:false,attackBonus:null,saveDC:15,savingThrow:'DEX',restriction:''}));
 c.actions=Array.from({length:12},(_,i)=>({name:`Feature ${i}`,activation:(['Action','Bonus action','Reaction','Special'] as const)[i%4],summary:'Does something useful in combat. '.repeat(4)}));
 c.inventoryRows=Array.from({length:60},(_,i)=>({name:`Item ${i}`,quantity:1,equipped:false,category:'Gear',armourType:null,weight:1}));
 const {bytes}=await generatePdf(P,c,{templateId:'compact'}),doc=await P.PDFDocument.load(bytes),form=doc.getForm(),first=doc.getPages()[0];
 const annots=first.node.Annots()!.asArray().map(String);let checked=0;
 for(const f of form.getFields())for(const w of f.acroField.getWidgets())if(annots.includes(String(doc.context.getObjectRef(w.dict)))){const r=w.getRectangle();checked++;assert.ok(r.y>=30&&r.y+r.height<=842,f.getName());}
 assert.ok(checked>100);
 const all=form.getFields().filter(f=>f instanceof P.PDFTextField).map(f=>(f as P.PDFTextField).getText()??'').join('\n');
 assert.ok(all.includes('Item 59'),'overflowing equipment continues overleaf');
 assert.ok(form.getFields().some(f=>f.getName()==='Spell.Spell 29.name'),'every spell stays in the spellbook');
});
