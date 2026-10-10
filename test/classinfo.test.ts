import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadTemplate} from './helpers/templates.ts';
// @ts-expect-error Browser-compatible JS
import {classStats} from '../src/pdf/class-info.js';
import * as PDFLib from 'pdf-lib';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser-compatible JS
import {generatePdf} from '../src/pdf/generator.js';
const fixture=async()=>JSON.parse(await readFile(new URL('../src/sample/martial.json',import.meta.url),'utf8'));
const stat=(c:any,label:string)=>classStats(c).find((s:any)=>s.label===label)?.value;
const flat=(v?:string)=>(v??'').replace(/\s+/g,' ');
async function fields(c:any,id:string){
 const main=await loadTemplate(id);
 const {bytes}=await generatePdf(PDFLib,c,{templateId:id,templateBytes:main.bytes,layout:main.layout});
 const form=(await PDFLib.PDFDocument.load(bytes)).getForm();
 return (suffix:string)=>{const f=form.getFields().find(f=>f.getName().replace(/-(Arc\d+|Alt)$/,'')===suffix);return f instanceof PDFLib.PDFTextField?f.getText()??'':undefined;};
}
test('hidden placeholder feats are skipped and proficiency-only traits keep a page reference',async()=>{
 const raw=await fixture();
 raw.data.feats=[{definition:{name:"Hero's Journey Boon",description:'At your GM\'s discretion.',categories:[{tagName:'__DISGUISE_FEAT'}]}}];
 raw.data.race={...raw.data.race,racialTraits:[{definition:{name:'Dwarven Combat Training',description:'You have proficiency with the battleaxe.',sources:[{sourceId:1,pageNumber:20}]}}]};
 const c=normalise(raw);
 assert.ok(!c.featureRows!.some(f=>f.name==="Hero's Journey Boon"));
 assert.deepEqual(c.featureRows!.find(f=>f.name==='Dwarven Combat Training'),{name:'Dwarven Combat Training',summary:'Included in proficiencies.',reference:'PHB (2014), p. 20',group:'Racial traits',level:0});
 assert.match(c.features,/Dwarven Combat Training \[PHB \(2014\), p\. 20\]: included in proficiencies\./);
});
test('class features hand their numbers to SheetSmith: dice, damage, attacks and DCs',async()=>{
 const base=normalise(await fixture());
 const barbarian={...base,classes:[{name:'Barbarian',level:9}]};
 assert.equal(stat(barbarian,'Rage damage'),'+3');assert.equal(stat(barbarian,'Brutal Critical'),'1 extra die');
 assert.equal(stat({...barbarian,classes:[{name:'Barbarian',level:17}]},'Rage damage'),'+4');
 assert.equal(stat({...barbarian,classes:[{name:'Barbarian',level:3}]},'Brutal Critical'),undefined);
 const rogue={...base,classes:[{name:'Rogue',level:5}]};
 assert.equal(stat(rogue,'Sneak Attack'),'3d6');
 assert.equal(stat({...rogue,classScales:[{name:'Sneak Attack',value:'4d6'}]},'Sneak Attack'),'4d6');
 assert.equal(stat({...base,classes:[{name:'Bard',level:9}]},'Song of Rest'),'d8');
 assert.equal(stat({...base,classes:[{name:'Monk',level:5}]},'Martial Arts die'),'d6');
 const druid=(sub:string,level:number)=>({...base,classes:[{name:'Druid',level,subclass:sub}]});
 assert.equal(stat(druid('Circle of the Land',8),'Wild Shape max CR'),'1');assert.equal(stat(druid('Circle of the Moon',9),'Wild Shape max CR'),'3');
 assert.equal(stat({...base,classes:[{name:'Wizard',level:9}]},'Wild Shape max CR'),undefined);
});
test('fighters list Extra Attack, and Battle Masters their die and maneuver DC',async()=>{
 const base=normalise(await fixture());
 const fighter=(level:number,subclass='Champion')=>({...base,classes:[{name:'Fighter',level,subclass}],proficiencyBonus:4});
 assert.equal(stat(fighter(4),'Extra Attack'),undefined);assert.equal(stat(fighter(5),'Extra Attack'),'+1');assert.equal(stat(fighter(11),'Extra Attack'),'+2');assert.equal(stat(fighter(20),'Extra Attack'),'+3');
 const master=fighter(11,'Battle Master');
 assert.equal(stat(master,'Superiority die'),'d10');
 assert.equal(stat(master,'Maneuver DC'),String(8+4+Math.max(base.abilities.strength.modifier,base.abilities.dexterity.modifier)));
 assert.equal(stat({...master,classScales:[{name:'Combat Superiority',value:'d12'}]},'Superiority die'),'d12');
 assert.equal(stat(fighter(3),'Maneuver DC'),undefined);
 assert.equal(stat(fighter(5,'Gunslinger'),'Trick Shot DC'),String(8+4+base.abilities.dexterity.modifier));
});
test('chosen options, cantrips and arcanum are counted for the classes that track them',async()=>{
 const base=normalise(await fixture());
 const feature=(name:string,parent:string)=>({name,summary:'x',reference:'',group:'Class features',level:3,parent});
 const sorcerer={...base,classes:[{name:'Sorcerer',level:3}],featureRows:[feature('Quickened Spell','Metamagic'),feature('Twinned Spell','Metamagic')]};
 assert.equal(stat(sorcerer,'Metamagic known'),'2');
 const warlock={...base,classes:[{name:'Warlock',level:11}],featureRows:[feature('Agonizing Blast','Eldritch Invocations')],spellRows:[{name:'Fire Bolt',level:0},{name:'Mass Suggestion',level:6}]};
 assert.equal(stat(warlock,'Invocations known'),'1');assert.equal(stat(warlock,'6th-level Arcanum'),'Mass Suggestion');assert.equal(stat(warlock,'Cantrips known'),'1');
 assert.deepEqual(classStats({...base,classes:[{name:'Wizard',level:1}],featureRows:[],spellRows:[]}),[]);
});
test('multiclass characters list the numbers of every class',async()=>{
 const base=normalise(await fixture());
 const labels=classStats({...base,classes:[{name:'Barbarian',level:5},{name:'Rogue',level:3}]}).map((s:any)=>s.label);
 assert.deepEqual(labels,['Rage damage','Sneak Attack']);
});
test('SheetSmith prints the class numbers without trouble for every supported class',async()=>{
 const base=normalise(await fixture());
 for(const [name,subclass] of [['Barbarian',''],['Bard',''],['Druid','Circle of the Moon'],['Fighter','Battle Master'],['Monk',''],['Rogue',''],['Sorcerer',''],['Warlock','']]){
  const c={...base,classes:[{name,level:11,subclass}],featureUses:[{name:'Rage',maximum:4,remaining:1,reset:'Long rest'}]};
  const {bytes}=await generatePdf(PDFLib,c,{templateId:'compact'});
  assert.ok(bytes.length>1000,name);
 }
});
test('official sheets show item weights, encumbrance, identity details, subclass and grouped training',async()=>{
 const base=normalise(await fixture());
 const c={...base,classes:[{name:'Fighter',level:3,subclass:'Eldritch Knight'}],details:{...base.details,gender:'Male',size:'Medium',faith:'Moradin',appearance:'Broad.'},
  inventoryRows:[{name:'Chain Mail',quantity:1,equipped:true,category:'Armor',armourType:3,weight:55}],carrying:{weight:55,capacity:285,pushDragLift:570},
  proficiencyGroups:{armour:['Heavy Armor'],weapons:['Martial Weapons'],tools:["Smith's Tools"]}};
 const get=await fields(c,'official-standard');
 assert.equal(get('ClassLevel'),'Fighter 3 (Eldritch Knight)');
 assert.match(flat(get('Equipment')),/Chain Mail \(equipped, 55 lb\)/);
 assert.match(flat(get('Equipment')),/Carried 55 lb · capacity 285 lb · push, drag or lift 570 lb/);
 assert.match(flat(get('Character appearance')),/^Gender: Male · Size: Medium · Faith: Moradin Broad\./);
 assert.match(flat(get('ProficienciesLang')),/Armour: Heavy Armor Weapons: Martial Weapons Tools: Smith's Tools/);
});
