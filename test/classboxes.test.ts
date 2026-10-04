import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser-compatible JS
import {generatePdf} from '../src/pdf/generator.js';
const fixture=async()=>JSON.parse(await readFile(new URL('./fixtures/martial.json',import.meta.url),'utf8'));
const load=async(id:string)=>({bytes:await readFile(new URL(`../templates/${id}.pdf`,import.meta.url)),layout:JSON.parse(await readFile(new URL(`../templates/${id}.json`,import.meta.url),'utf8'))});
const flat=(v?:string)=>(v??'').replace(/\s+/g,' ');
async function fields(c:any,id:string){
 const main=await load(id),family=id.startsWith('class-')?'class':'official';
 const {bytes}=await generatePdf(PDFLib,c,{templateId:id,templateBytes:main.bytes,layout:main.layout,reference:await load(`${family}-reference`)});
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
test('class sheets fill resource pools, scale dice and chosen options',async()=>{
 const base=normalise(await fixture());
 const barbarian={...base,classes:[{name:'Barbarian',level:9}],featureUses:[{name:'Rage',maximum:4,remaining:1,reset:'Long rest'}]};
 let get=await fields(barbarian,'class-barbarian');
 assert.equal(get('Front_Rage Total'),'4');assert.equal(get('Front_Rage Used'),'3');
 assert.equal(get('Front_Rage Damage'),'+3');assert.equal(get('Front_Brutal Critical Die'),'1');
 const rogue={...base,classes:[{name:'Rogue',level:5}],classScales:[{name:'Sneak Attack',value:'3d6'}]};
 get=await fields(rogue,'class-rogue');assert.equal(get('Front_Sneak Attack'),'3d6');
 const sorcerer={...base,classes:[{name:'Sorcerer',level:3}],featureUses:[{name:'Sorcery Points',maximum:3,remaining:3,reset:'Long rest'}],
  featureRows:[{name:'Metamagic',summary:'Choose two options.',reference:'',group:'Class features',level:3},{name:'Quickened Spell',summary:'Cast as a bonus action.',reference:'PHB (2014), p. 102',group:'Class features',level:0,parent:'Metamagic'},{name:'Twinned Spell',summary:'Target a second creature.',reference:'PHB (2014), p. 102',group:'Class features',level:0,parent:'Metamagic'}]};
 get=await fields(sorcerer,'class-sorcerer');
 assert.equal(get('Front_Sorcery Points Total'),'3');assert.equal(get('Front_Sorcery Points Used'),'0');
 assert.match(get('Front_Metamagic Options')!,/Quickened Spell: Cast as a bonus action\..*\n.*Twinned Spell/s);
 assert.equal(get('Front_Metamagic Known'),'2');
 assert.doesNotMatch(get('Back_Additional Features & Traits')??'',/Choose two options|Sorcery Points: 3\/3/);
});
test('fighter sheets show the shield bonus and Extra Attack from the PHB table',async()=>{
 const base=normalise(await fixture());
 const c={...base,classes:[{name:'Fighter',level:11,subclass:'Battle Master'}],inventoryRows:[{name:'Shield',quantity:1,equipped:true,category:'Armor',armourType:4,armourClass:2}]};
 const get=await fields(c,'class-fighter-battle-master');
 assert.equal(get('Front_Shield Bonus'),'+2');assert.equal(get('Front_Extra Attack'),'2');
 assert.equal(get('Front_Superiority Die'),'d10');
 assert.equal(get('Front_Maneuver DC'),String(8+c.proficiencyBonus+Math.max(c.abilities.strength.modifier,c.abilities.dexterity.modifier)));
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
