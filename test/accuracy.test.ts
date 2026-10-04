import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
const fixture=async()=>JSON.parse(await readFile(new URL('./fixtures/martial.json',import.meta.url),'utf8'));
const table=(rows:Record<number,number[]>)=>Array.from({length:21},(_,level)=>rows[level]??[]);
// D&D Beyond flags casting per class and subclass, and gives each class its multiclass divisor and rounding.
const caster=(name:string,level:number,divisor:number,rounding=1,slots:Record<number,number[]>={})=>({level,definition:{name,hitDice:8,canCastSpells:true,spellRules:{multiClassSpellSlotDivisor:divisor,multiClassSpellSlotRounding:rounding,levelSpellSlots:table(slots)}}});
const totals=(c:ReturnType<typeof normalise>)=>c.spellSlots!.map(s=>s.total);
test('a subclass that cannot cast gets no slots from the class table it shares with casting subclasses',async()=>{
 const raw=await fixture(),fighter=raw.data.classes[0];
 fighter.definition={...fighter.definition,canCastSpells:false,spellRules:{multiClassSpellSlotDivisor:3,levelSpellSlots:table({5:[3]})}};
 fighter.subclassDefinition={name:'Champion',canCastSpells:false};
 assert.deepEqual(normalise(raw).spellSlots,[]);
 fighter.subclassDefinition={name:'Eldritch Knight',canCastSpells:true};
 assert.deepEqual(totals(normalise(raw)),[3]);
});
test('multiclass casters combine caster levels on the PHB table; Pact Magic stays separate',async()=>{
 const raw=await fixture(),d=raw.data;
 d.classes=[caster('Wizard',3,1),caster('Cleric',2,1)];
 assert.deepEqual(totals(normalise(raw)),[4,3,2]);
 // Half casters round down (Paladin 1 adds nothing); Artificer rounds up.
 d.classes=[caster('Paladin',1,2),caster('Sorcerer',3,1)];
 assert.deepEqual(totals(normalise(raw)),[4,2]);
 d.classes=[caster('Artificer',3,2,2),caster('Wizard',1,1)];
 assert.deepEqual(totals(normalise(raw)),[4,2]);
 // With Pact Magic beside one other caster, that caster keeps its own table.
 d.classes=[caster('Warlock',2,0,1,{2:[2]}),caster('Sorcerer',3,1,1,{3:[4,2]})];
 assert.deepEqual(totals(normalise(raw)),[4,2]);
 d.classes=[caster('Wizard',3,1),{...caster('Cleric',2,1),definition:{...caster('Cleric',2,1).definition,spellRules:{levelSpellSlots:table({2:[3]})}}}];
 const c=normalise(raw);
 assert.deepEqual(c.spellSlots,[]);
 assert.ok(c.warnings.some(w=>/Multiclass spell slots/.test(w)));
});
test('equipped, attuned magic items change saves and scores; unattuned ones do not',async()=>{
 const raw=await fixture(),d=raw.data,before=normalise(raw);
 const item=(name:string,isAttuned:boolean,grantedModifiers:object[])=>({quantity:1,equipped:true,isAttuned,definition:{name,magic:true,canAttune:true,rarity:'Uncommon',filterType:'Wondrous item',snippet:`${name} effect.`,grantedModifiers}});
 d.inventory.push(item('Cloak of Protection',true,[{type:'bonus',subType:'saving-throws',value:1}]),item('Ring of Protection',false,[{type:'bonus',subType:'saving-throws',value:1}]),item('Headband of Intellect',true,[{type:'set',subType:'intelligence-score',value:19}]));
 const c=normalise(raw);
 assert.deepEqual(c.saves.map(s=>s.bonus),before.saves.map((s,i)=>s.bonus+1+(i===3?4:0)));
 assert.equal(c.abilities.intelligence.score,19);
 d.stats[3].value=20;assert.equal(normalise(raw).abilities.intelligence.score,20,'a higher score is kept');
 const cloak=c.inventoryRows!.find(r=>r.name==='Cloak of Protection')!;
 assert.deepEqual([cloak.magic,cloak.rarity,cloak.attunement,cloak.attuned,cloak.summary],[true,'Uncommon',true,true,'Cloak of Protection effect.']);
 assert.equal(c.inventoryRows!.find(r=>r.name==='Longsword')!.magic,undefined);
});
test('Jack of All Trades and Remarkable Athlete add half proficiency to checks without proficiency',async()=>{
 const raw=await fixture(),d=raw.data,base=normalise(raw),bonus=(c:ReturnType<typeof normalise>,n:string)=>c.skills.find(s=>s.name===n)!.bonus;
 d.modifiers.class.push({type:'half-proficiency',subType:'ability-checks'});
 const bard=normalise(raw);
 assert.equal(bonus(bard,'Arcana'),bonus(base,'Arcana')+1);
 assert.equal(bonus(bard,'Athletics'),bonus(base,'Athletics'),'proficient skills are unchanged');
 assert.equal(bard.combat.initiative,base.combat.initiative+1);
 d.modifiers.class.pop();
 d.modifiers.class.push({type:'half-proficiency-round-up',subType:'dexterity-ability-checks'});
 const champion=normalise(raw);
 assert.equal(bonus(champion,'Acrobatics'),bonus(base,'Acrobatics')+2);
 assert.equal(bonus(champion,'Arcana'),bonus(base,'Arcana'));
 assert.equal(champion.combat.initiative,base.combat.initiative+2);
});
test('species movement other than walking is listed',async()=>{
 const raw=await fixture();raw.data.race.weightSpeeds.normal={walk:30,swim:30,fly:0,climb:20};
 assert.deepEqual(normalise(raw).speeds,['Swim 30 ft.','Climb 20 ft.']);
});
