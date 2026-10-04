import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
const fixture=()=>({data:{name:'Test dwarf',stats:[17,13,17,17,14,13].map((value,i)=>({id:i+1,value})),classes:[{level:3,definition:{name:'Fighter',hitDice:10}}],baseHitPoints:22,race:{fullName:'Mountain Dwarf',weightSpeeds:{normal:{walk:25}}},modifiers:{race:[{type:'bonus',subType:'strength-score',value:2},{type:'bonus',subType:'constitution-score',value:2},{type:'ignore',subType:'heavy-armor-speed-reduction'}]},inventory:[{equipped:true,definition:{name:'Chain Mail',armorClass:16,armorTypeId:3,strengthRequirement:13}},{equipped:true,definition:{name:'Shield',armorClass:2,armorTypeId:4}}]}});
test('5e dwarf fighter derives AC 18, HP 34 and speed 25 without overrides',()=>{
 const c=normalise(fixture());assert.equal(c.combat.armourClass,18);assert.equal(c.combat.maxHP,34);assert.equal(c.combat.speed,25);
});
test('shield unequipping and medium-armour Dexterity cap change AC',()=>{
 const r=fixture();r.data.inventory[1].equipped=false;r.data.inventory[0].definition.armorTypeId=2;r.data.inventory[0].definition.armorClass=14;r.data.stats[1].value=18;
 assert.equal(normalise(r).combat.armourClass,16);
});
test('missing base HP stays unknown; explicit overrides win',()=>{
 const r:any=fixture();delete r.data.baseHitPoints;assert.equal(normalise(r).combat.maxHP,null);
 r.data.overrideArmorClass=21;r.data.overrideHitPoints=40;const c=normalise(r);assert.equal(c.combat.armourClass,21);assert.equal(c.combat.maxHP,40);
});
test('unattuned magic items do not grant AC and conditional speed stays unresolved',()=>{
 const r:any=fixture();r.data.inventory.push({equipped:true,isAttuned:false,definition:{canAttune:true,grantedModifiers:[{type:'bonus',subType:'armor-class',value:1}]}});
 assert.equal(normalise(r).combat.armourClass,18);r.data.inventory[2].isAttuned=true;assert.equal(normalise(r).combat.armourClass,19);
 r.data.modifiers.race.push({type:'bonus',subType:'speed',value:10,restriction:'While raging'});assert.equal(normalise(r).combat.speed,null);
});
