import type {Character} from '../../character/model.ts';
import {plainText} from './text.ts';
import {characterModifiers,total} from './modifiers.ts';
import {signed as sign} from '../../character/calculations.ts';
type Data=Record<string,any>;
export function loadout(raw:Data,scores:Character['abilities'],proficiency:number){
 // Weight is per bundle (20 bolts weigh 1.5 lb); stealthCheck 2 marks armour that imposes Stealth disadvantage.
 const inventoryRows:NonNullable<Character['inventoryRows']>=(raw.inventory??[]).map((i:Data)=>{const d=i.definition??{},quantity=i.quantity??1;
  return {name:plainText(d.name),quantity,equipped:!!i.equipped,category:plainText(d.filterType),armourType:d.armorTypeId??null,armourClass:Number.isFinite(d.armorClass)?d.armorClass:null,
   weight:Math.round((Number(d.weight)||0)*(Number(d.weightMultiplier)||1)*quantity/(Number(d.bundleSize)||1)*100)/100,attuned:!!i.isAttuned,stealthDisadvantage:d.stealthCheck===2,
   ...(d.magic?{magic:true,rarity:plainText(d.rarity),attunement:!!d.canAttune,summary:plainText(d.snippet)||plainText(d.description)}:{})};});
 const mods=characterModifiers(raw).filter(m=>!m.restriction);
 const proficiencyNames=mods.filter((m:Data)=>m.type==='proficiency').map((m:Data)=>String(m.friendlySubtypeName??m.subType).toLowerCase().replace(/[^a-z0-9]/g,''));
 const allowed=new Set(['Ammunition','Finesse','Heavy','Light','Loading','Range','Reach','Special','Thrown','Two-Handed','Versatile']);
 // Fighting styles and similar features arrive as unrestricted weapon modifiers (Dueling: damage, one-handed-melee-attacks).
 const weapons=(raw.inventory??[]).filter((i:Data)=>i.definition?.filterType==='Weapon').sort((a:Data,b:Data)=>Number(!!b.equipped)-Number(!!a.equipped)).map((i:Data)=>{
  const d=i.definition,properties=(d.properties??[]).filter((p:Data)=>allowed.has(p.name));
  const melee=d.attackType===1,twoHanded=properties.some((p:Data)=>p.name==='Two-Handed');
  const reach=melee?['melee-weapon-attacks','weapon-attacks']:['ranged-weapon-attacks','weapon-attacks'];
  const oneHanded=melee&&!twoHanded?total(mods,'damage',['one-handed-melee-attacks']):0;
  const extraDamage=total(mods,'damage',reach)+oneHanded,extraAttack=total(mods,'bonus',reach);
  const finesse=properties.some((p:Data)=>p.name==='Finesse');
  const modifier=finesse?Math.max(scores.strength.modifier,scores.dexterity.modifier):d.attackType===2?scores.dexterity.modifier:scores.strength.modifier;
  const category=d.categoryId===1?'simpleweapons':d.categoryId===2?'martialweapons':'';
  const proficient=proficiencyNames.includes(category)||[d.name,d.type].some(n=>proficiencyNames.includes(String(n??'').toLowerCase().replace(/[^a-z0-9]/g,'')));
  // Base rolls only: conditional styles, alternate abilities and magic effects are not silently activated.
  const supported=[1,2].includes(d.attackType)&&!d.magic&&!d.isHomebrew;
  const dice=plainText(d.damage?.diceString)||String(d.fixedDamage??'');
  return {name:plainText(d.name),equipped:!!i.equipped,attackBonus:supported?modifier+(proficient?proficiency:0)+extraAttack:null,damage:`${dice}${supported&&dice?' '+sign(modifier+extraDamage):''} ${plainText(d.damageType)}`.trim(),notes:[d.range?`Range ${d.range}${d.longRange>d.range?'/'+d.longRange:''} ft`:'',properties.map((p:Data)=>p.name+(p.notes?' ('+plainText(p.notes)+')':'')).join(', '),supported&&oneHanded?`Includes ${sign(oneHanded)} damage when wielded in one hand with no other weapon`:'',supported?'Base roll; conditional bonuses not included.':'Check attack and damage bonuses.'].filter(Boolean).join('; ')};
 });
 return {inventoryRows,weapons};
}
// The attack table follows the D&D Beyond sheet: equipped weapons, damaging cantrips, unarmed strike, then carried weapons.
export function attackRows(weapons:NonNullable<Character['weapons']>,spells:NonNullable<Character['spellRows']>,scores:Character['abilities'],proficiency:number,classes:Character['classes']):NonNullable<Character['attacks']>{
 const weapon=(w:typeof weapons[number])=>({name:w.name,source:'weapon' as const,attackBonus:w.attackBonus,damage:w.damage,notes:w.notes});
 const cantrips=spells.filter(s=>s.level===0&&s.damage&&(s.requiresAttack||s.requiresSave)).map(s=>({name:s.name,source:'spell' as const,attackBonus:s.requiresAttack?s.attackBonus??null:null,save:s.requiresSave&&!s.requiresAttack?`${s.savingThrow} ${s.saveDC??'?'}`.trim():undefined,damage:s.damage!,notes:[s.range,s.components].filter(Boolean).join('; ')}));
 // Monks use the Martial Arts die and the better of STR or DEX; everyone else deals 1 + STR.
 const monk=classes.find(c=>c.name==='Monk')?.level??0;
 const mod=monk?Math.max(scores.strength.modifier,scores.dexterity.modifier):scores.strength.modifier;
 const die=monk>=17?'1d10':monk>=11?'1d8':monk>=5?'1d6':monk?'1d4':'';
 const unarmed={name:'Unarmed Strike',source:'unarmed' as const,attackBonus:mod+proficiency,damage:die?`${die} ${sign(mod)} Bludgeoning`:`${Math.max(1,1+mod)} Bludgeoning`,notes:monk?'Martial Arts':'Melee; 5 ft'};
 return [...weapons.filter(w=>w.equipped).map(weapon),...cantrips,unarmed,...weapons.filter(w=>!w.equipped).map(weapon)];
}
