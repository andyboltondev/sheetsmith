import type {Character} from '../../character/model.ts';
import {plainText} from './text.ts';
type Data=Record<string,any>;
const sign=(n:number)=>n>=0?`+${n}`:String(n);
export function loadout(raw:Data,scores:Character['abilities'],proficiency:number){
 const inventoryRows=(raw.inventory??[]).map((i:Data)=>({name:plainText(i.definition?.name),quantity:i.quantity??1,equipped:!!i.equipped,category:plainText(i.definition?.filterType),armourType:i.definition?.armorTypeId??null}));
 const mods=['race','class','background','feat'].flatMap(k=>raw.modifiers?.[k]??[]).filter((m:Data)=>!m.restriction);
 const proficiencyNames=mods.filter((m:Data)=>m.type==='proficiency').map((m:Data)=>String(m.friendlySubtypeName??m.subType).toLowerCase().replace(/[^a-z0-9]/g,''));
 const allowed=new Set(['Ammunition','Finesse','Heavy','Light','Loading','Range','Reach','Special','Thrown','Two-Handed','Versatile']);
 const weapons=(raw.inventory??[]).filter((i:Data)=>i.definition?.filterType==='Weapon').sort((a:Data,b:Data)=>Number(!!b.equipped)-Number(!!a.equipped)).map((i:Data)=>{
  const d=i.definition,properties=(d.properties??[]).filter((p:Data)=>allowed.has(p.name));
  const finesse=properties.some((p:Data)=>p.name==='Finesse');
  const modifier=finesse?Math.max(scores.strength.modifier,scores.dexterity.modifier):d.attackType===2?scores.dexterity.modifier:scores.strength.modifier;
  const category=d.categoryId===1?'simpleweapons':d.categoryId===2?'martialweapons':'';
  const proficient=proficiencyNames.includes(category)||[d.name,d.type].some(n=>proficiencyNames.includes(String(n??'').toLowerCase().replace(/[^a-z0-9]/g,'')));
  // Base rolls only: conditional styles, alternate abilities and magic effects are not silently activated.
  const supported=[1,2].includes(d.attackType)&&!d.magic&&!d.isHomebrew;
  const dice=plainText(d.damage?.diceString)||String(d.fixedDamage??'');
  return {name:plainText(d.name),equipped:!!i.equipped,attackBonus:supported?modifier+(proficient?proficiency:0):null,damage:`${dice}${supported&&dice?' '+sign(modifier):''} ${plainText(d.damageType)}`.trim(),notes:[d.range?`Range ${d.range}${d.longRange>d.range?'/'+d.longRange:''} ft`:'',properties.map((p:Data)=>p.name+(p.notes?' ('+plainText(p.notes)+')':'')).join(', '),supported?'Base roll; conditional bonuses not included.':'Check attack and damage bonuses.'].filter(Boolean).join('; ')};
 });
 return {inventoryRows,weapons};
}
