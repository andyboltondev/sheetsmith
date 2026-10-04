import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser-compatible JS
import {generatePdf} from '../src/pdf/generator.js';
// Mirrors the D&D Beyond export for a Mountain Dwarf Eldritch Knight with the Dueling style.
async function raw(){
 const raw=JSON.parse(await readFile(new URL('./fixtures/martial.json',import.meta.url),'utf8'));
 raw.data.inventory=[
  {quantity:1,equipped:true,definition:{name:'Warhammer',filterType:'Weapon',type:'Warhammer',categoryId:2,attackType:1,damage:{diceString:'1d8'},damageType:'Bludgeoning',range:5,properties:[{name:'Versatile',notes:'1d10'}]}},
  {quantity:1,equipped:true,definition:{name:'Greataxe',filterType:'Weapon',type:'Greataxe',categoryId:2,attackType:1,damage:{diceString:'1d12'},damageType:'Slashing',range:5,properties:[{name:'Two-Handed'},{name:'Heavy'}]}},
  {quantity:1,equipped:true,definition:{name:'Crossbow, Light',filterType:'Weapon',type:'Crossbow, Light',categoryId:1,attackType:2,damage:{diceString:'1d8'},damageType:'Piercing',range:80,longRange:320,properties:[{name:'Two-Handed'}]}},
 ];
 raw.data.modifiers.class.push({type:'proficiency',subType:'martial-weapons',friendlySubtypeName:'Martial Weapons'},{type:'proficiency',subType:'simple-weapons',friendlySubtypeName:'Simple Weapons'},{type:'damage',subType:'one-handed-melee-attacks',value:2,restriction:''});
 raw.data.modifiers.race=[{type:'set-base',subType:'darkvision',value:60,restriction:''},{type:'resistance',subType:'poison',friendlySubtypeName:'Poison',restriction:''},{type:'advantage',subType:'saving-throws',friendlySubtypeName:'Saving Throws',restriction:'Against Poison'}];
 raw.data.classes[0].id=123;raw.data.classes[0].subclassDefinition={name:'Eldritch Knight',spellCastingAbilityId:4};
 const scale=()=>({higherLevelDefinitions:[5,11,17].map((level,i)=>({level,dice:{diceString:`${i+2}d10`}}))});
 raw.data.classSpells=[{characterClassId:123,spells:[
  {definition:{id:10,name:'Fire Bolt',level:0,requiresAttackRoll:true,range:{rangeValue:120},components:[1,2],description:'Ranged spell attack.',modifiers:[{type:'damage',subType:'fire',friendlySubtypeName:'Fire',die:{diceString:'1d10'},atHigherLevels:scale()}],sources:[{sourceId:2,pageNumber:242}]}},
  {definition:{id:11,name:'Shield',level:1,description:'+5 AC until the start of your next turn.'}},
  {definition:{id:12,name:'Thunderwave',level:1,requiresSavingThrow:true,saveDcAbilityId:3,description:'Thunder.',modifiers:[{type:'damage',subType:'thunder',die:{diceString:'2d8'}}]}},
 ]}];
 raw.data.spellSlots=[{level:1,used:1}];
 raw.data.classes[0].definition.spellRules={levelSpellSlots:Array.from({length:21},(_,l)=>l>=3?[2]:[])};
 return raw;
}
const sample=async()=>normalise(await raw());
test('unconditional weapon modifiers such as Dueling reach one-handed melee damage only',async()=>{
 const c=await sample(),str=c.abilities.strength.modifier;
 const by=(n:string)=>c.weapons!.find(w=>w.name===n)!;
 assert.match(by('Warhammer').damage,new RegExp(`1d8 \\+${str+2} Bludgeoning`));
 assert.match(by('Warhammer').notes,/one hand with no other weapon/);
 assert.match(by('Greataxe').damage,new RegExp(`1d12 \\+${str} Slashing`));
 assert.match(by('Crossbow, Light').damage,new RegExp(`1d8 \\+${c.abilities.dexterity.modifier} Piercing`));
});
test('attack rows add damaging cantrips scaled by character level, then unarmed strike',async()=>{
 const c=await sample(),names=c.attacks!.map(a=>a.name);
 assert.deepEqual(names,['Warhammer','Greataxe','Crossbow, Light','Fire Bolt','Unarmed Strike']);
 const bolt=c.attacks!.find(a=>a.name==='Fire Bolt')!;
 assert.equal(bolt.damage,'2d10 Fire');
 assert.equal(bolt.attackBonus,c.abilities.intelligence.modifier+c.proficiencyBonus);
 assert.equal(c.attacks!.at(-1)!.damage,`${1+c.abilities.strength.modifier} Bludgeoning`);
});
test('senses, defences, save notes and extra passive scores are imported',async()=>{
 const c=await sample();
 assert.deepEqual(c.senses,['Darkvision 60 ft.']);
 assert.deepEqual(c.defences,{resistances:['Poison'],immunities:[],vulnerabilities:[],saveNotes:['Advantage on saving throws against poison']});
 assert.equal(c.passiveInsight,10+c.skills.find(s=>s.name==='Insight')!.bonus);
 assert.equal(c.passiveInvestigation,10+c.skills.find(s=>s.name==='Investigation')!.bonus);
});
const load=async(id:string)=>({bytes:await readFile(new URL(`../templates/${id}.pdf`,import.meta.url)),layout:JSON.parse(await readFile(new URL(`../templates/${id}.json`,import.meta.url),'utf8'))});
test('official sheets add the spellcasting page and show cantrips, senses and defences',async()=>{
 const c=await sample(),main=await load('official-standard');
 const {bytes}=await generatePdf(PDFLib,c,{templateId:'official-standard',templateBytes:main.bytes,layout:main.layout,spellResource:await load('official-spells')});
 const doc=await PDFLib.PDFDocument.load(bytes),form=doc.getForm(),text=(n:string)=>form.getTextField(n).getText()??'';
 assert.ok(doc.getPageCount()>=3,'spellcasting page added');
 const field=(suffix:string)=>form.getFields().find(f=>f.getName().startsWith('Spellcasting')&&f.getName().endsWith('.'+suffix)) as PDFLib.PDFTextField;
 assert.equal(field('SpellcastingAbility 2').getText(),'INT');
 assert.equal(field('SlotsTotal 19').getText(),'2');
 assert.equal(field('SlotsRemaining 19').getText(),'1');
 const names=form.getFields().filter(f=>/^Spellcasting\d+\.Spells /.test(f.getName())).map(f=>(f as PDFLib.PDFTextField).getText()).filter(Boolean);
 assert.deepEqual(names.sort(),['Fire Bolt','Shield','Thunderwave']);
 assert.match(text('AttacksSpellcasting'),/Fire Bolt: \+\d, 2d10 Fire/);
 assert.match(text('AttacksSpellcasting'),/Unarmed Strike/);
 assert.match(text('ProficienciesLang'),/Senses: Darkvision 60 ft\.[\s\S]*Resistances: Poison[\s\S]*Advantage on saving throws against\spoison/);
 assert.match(text('Feat+Traits'),/SPELL DETAILS[\s\S]*Thunderwave \(level 1\)[^\n]*CON save DC/);
});
