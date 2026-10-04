import { gameplayText } from './concise.ts';
import { characterModifiers } from './modifiers.ts';
import { abilities, type Character } from '../../character/model.ts';
import { signed } from '../../character/calculations.ts';
import { skillAbilities } from '../../character/skills.ts';
type Data=Record<string,any>;
import { plainText } from './text.ts';
export { plainText } from './text.ts';
export function sourceReference(d:Data):string {
 if(d.isHomebrew)return 'Homebrew';
 const sources=d.sources??[];
 const phb=sources.find((s:Data)=>s.sourceId===2&&Number.isInteger(s.pageNumber)&&s.pageNumber>0);
 if(phb)return `PHB (2014), p. ${phb.pageNumber}`;
 if(d.sourceId===2&&Number.isInteger(d.sourcePageNumber)&&d.sourcePageNumber>0)return `PHB (2014), p. ${d.sourcePageNumber}`;
 // D&D Beyond numbers Basic Rules entries by their PHB page (Dwarf traits 20, Fighter 70), and the
 // Basic Rules are a subset of the PHB, so these cite the PHB as players' books do.
 const basic=sources.find((s:Data)=>s.sourceId===1&&Number.isInteger(s.pageNumber)&&s.pageNumber>0);
 return basic?`PHB (2014), p. ${basic.pageNumber}`:'';
}
function resolveSnippet(text:string,level:number,scale:Data,scores:Character['abilities'],prof:number):string {
 const short:Record<string,string>={str:'strength',dex:'dexterity',con:'constitution',int:'intelligence',wis:'wisdom',cha:'charisma'};
 return text.replace(/\{\{([^}]+)\}\}/g,(_,token:string)=>{
  if(token==='classlevel')return String(level);
  if(token==='proficiency')return String(prof);
  if(token==='scalevalue')return String(scale?.fixedValue??scale?.dice?.diceString??'{{scalevalue}}');
  const [kind,ability]=token.split(':');const a=scores[short[ability] as keyof typeof scores];
  if(a&&kind==='savedc')return String(8+prof+a.modifier);
  if(a&&kind==='spellattack')return signed(prof+a.modifier);
  if(a&&kind==='modifier')return String(a.modifier);
  return `{{${token}}}`;
 });
}
// PHB (2014) simple weapons; any other named weapon is martial. Used to drop names a category already covers.
const simpleWeapons=new Set(['club','dagger','greatclub','handaxe','javelin','light hammer','mace','quarterstaff','sickle','spear','crossbow, light','dart','shortbow','sling']);
const armourOrder=(name:string)=>['Light Armor','Medium Armor','Heavy Armor','Shields'].indexOf(name)>>>0;
export function gameplay(raw:Data,scores:Character['abilities'],prof:number){
 const featureRows:NonNullable<Character['featureRows']>=[];
 const skip=new Set(['Proficiencies','Hit Points','Equipment','Ability Score Increase','Ability Score Improvement','Age','Languages','Speed','Size','Martial Archetype']);
 // Traits whose whole effect is a proficiency are listed by name and page only; the proficiency lists carry the rule.
 const proficiencyOnly=new Set(['Tool Proficiency','Dwarven Combat Training','Dwarven Armor Training','Elf Weapon Training']);
 const classScales:NonNullable<Character['classScales']>=[];
 const append=(entry:Data,level:number,group:string,parent?:string)=>{
  const d=entry.definition??entry;if(!d.name||skip.has(d.name)||d.hideInSheet)return;
  // D&D Beyond's placeholder feats (Hero's Journey Boon, Dark Bargain) are hidden on its own sheet.
  if((d.categories??[]).some((c:Data)=>(c?.tagName??c)==='__DISGUISE_FEAT'))return;
  if(d.requiredLevel>level)return;
  if(proficiencyOnly.has(d.name)){featureRows.push({name:plainText(d.name),summary:'Included in proficiencies.',reference:sourceReference(d),group,level:d.requiredLevel??0});return;}
  let summary=resolveSnippet(plainText(d.snippet),level,entry.levelScale,scores,prof);
  if(!summary||summary.includes('{{'))summary=plainText(d.description);
  summary=gameplayText(summary,sourceReference(d),level).replace(/\b1 times\b/g,'once');
  if(sourceReference(d)==='PHB (2014), p. 75'&&d.name==='Weapon Bond')summary='1-hour ritual; bond up to two weapons. Cannot be disarmed unless incapacitated. Bonus action: summon one bonded weapon from the same plane.';
  if(sourceReference(d)==='PHB (2014), p. 75'&&d.name==='Spellcasting')summary=`INT spellcasting: save DC ${8+prof+scores.intelligence.modifier}; spell attack ${signed(prof+scores.intelligence.modifier)}. Use known wizard spells.`;
  const scale=entry.levelScale?.dice?.diceString??entry.levelScale?.fixedValue;
  if(scale!=null&&scale!=='')classScales.push({name:plainText(d.name),value:String(scale)});
  if(!summary)return;
  featureRows.push({name:plainText(d.name),summary,reference:sourceReference(d),group,level:d.requiredLevel??0,...(parent?{parent}:{})});
 };
 for(const f of raw.race?.racialTraits??[])append(f,20,'Racial traits');
 for(const f of raw.feats??[])append(f,20,'Feats');
 for(const c of raw.classes??[]){const baseIds=new Set((c.definition?.classFeatures??[]).map((f:Data)=>(f.definition??f).id));const ids=new Set((c.subclassDefinition?.classFeatures??[]).map((f:Data)=>(f.definition??f).id).filter((id:number)=>!baseIds.has(id)));for(const f of c.classFeatures??[])append(f,c.level,ids.has((f.definition??f).id)?'Subclass features':'Class features');}
 // Selected options (such as fighting styles) replace generic choice instructions.
 for(const group of Object.values(raw.options??{}) as any[])for(const o of group??[]){if(o.definition?.name){const parent=(raw.classes??[]).flatMap((c:Data)=>c.classFeatures??[]).find((f:Data)=>f.definition?.id===o.componentId);append({...o,definition:{...o.definition,sources:o.definition.sources?.length?o.definition.sources:parent?.definition?.sources}},20,'Class features',parent?.definition?.name?plainText(parent.definition.name):undefined);}}
 if((raw.options?.class??[]).some((o:Data)=>(raw.classes??[]).some((c:Data)=>(c.classFeatures??[]).some((f:Data)=>f.definition?.name==='Fighting Style'&&f.definition?.id===o.componentId)))){
  const generic=featureRows.findIndex(f=>f.name==='Fighting Style');if(generic>=0)featureRows.splice(generic,1);
 }
 const spells:NonNullable<Character['spellRows']>=[];
 const entries=[...(raw.classSpells??[]).flatMap((c:Data)=>{const owner=(raw.classes??[]).find((v:Data)=>v.id===c.characterClassId);return (c.spells??[]).map((spell:Data)=>({...spell,_ability:owner?.subclassDefinition?.spellCastingAbilityId??owner?.definition?.spellCastingAbilityId}));}),...Object.values(raw.spells??{}).flatMap((s:any)=>Array.isArray(s)?s:[])];
 const seen=new Map<string,number>();const level=(raw.classes??[]).reduce((s:number,c:Data)=>s+c.level,0);
 for(const entry of entries){
  const d=entry.definition??{};if(!d.name)continue;const key=`${d.id??d.name}:${d.isLegacy}:${entry.restriction??''}`;if(seen.has(key)){const previous=spells[seen.get(key)!];previous.prepared ||= !!(entry.prepared||entry.alwaysPrepared);continue;}seen.set(key,spells.length);
  const activation=entry.activation??d.activation??{};const type:Record<number,string>={1:'Action',3:'Bonus action',4:'Reaction',6:'Minute',7:'Hour'};
  const casting=type[activation.activationType]?`${activation.activationTime>1?activation.activationTime+' ':''}${type[activation.activationType]}`:plainText(d.castingTimeDescription)||'See spell';
  const r=entry.range??d.range??{};const range=r.rangeValue?`${r.rangeValue} ft${r.aoeValue?`; ${r.aoeValue}-ft ${r.aoeType??'area'}`:''}`:r.origin??'See spell';
  const duration=d.duration?.durationType==='Instantaneous'?'Instantaneous':d.duration?.durationInterval?`${d.duration.durationInterval} ${d.duration.durationUnit}`:d.duration?.durationType??'See spell';
  const components=(d.components??[]).map((n:number)=>({1:'V',2:'S',3:'M'}[n])).filter(Boolean).join(', ')+(d.componentsDescription?` (${plainText(d.componentsDescription)})`:'');
  let summary=plainText(d.snippet)||plainText(d.description);
  const phb=sourceReference(d).startsWith('PHB (2014)');
  if(phb){
   const dice=level>=17?4:level>=11?3:level>=5?2:1;
   const compact:Record<string,string>={
    'Fire Bolt':`Ranged spell attack: ${dice}d10 fire damage. Ignites flammable objects that are not worn or carried.`,
    'Ray of Frost':`Ranged spell attack: ${dice}d8 cold damage; target speed -10 ft until the start of your next turn.`,
    'Shield':'Reaction when hit by an attack or targeted by Magic Missile. +5 AC, including against the triggering attack, until the start of your next turn; Magic Missile deals no damage.',
    'Magic Missile':'Three darts; each deals 1d4 + 1 force damage. Automatically hit creatures you can see; split targets as desired. All strike together.',
    'Thunderwave':'15-ft cube from you. CON save: 2d8 thunder damage and push 10 ft away; success halves damage, no push. Unsecured objects fully inside are pushed 10 ft. Audible 300 ft.'
   };summary=compact[d.name]??summary;
  }
  summary=gameplayText(summary,sourceReference(d),level);
  if(entry.additionalDescription)summary+=' '+plainText(entry.additionalDescription);
  const abilityId=entry.spellCastingAbilityId??entry._ability;const keyAbility=abilities[abilityId-1];const spellModifier=scores[keyAbility]?.modifier;
  const attackBonus=spellModifier===undefined?null:prof+spellModifier;const saveDC=entry.overrideSaveDc??(spellModifier===undefined?null:8+prof+spellModifier);
  // Damage dice from the spell's own modifiers; cantrips scale with total character level.
  const hit=(d.modifiers??[]).find((m:Data)=>m.type==='damage'&&m.die?.diceString);
  const scaled=d.level===0?(hit?.atHigherLevels?.higherLevelDefinitions??[]).filter((h:Data)=>h.level<=level&&h.dice?.diceString).sort((a:Data,b:Data)=>b.level-a.level)[0]:undefined;
  const damage=hit?`${plainText(scaled?.dice?.diceString??hit.die.diceString)} ${plainText(hit.friendlySubtypeName??hit.subType).replace(/^./,(c:string)=>c.toUpperCase())}`:'';
  spells.push({ability:abilities[abilityId-1]?.slice(0,3).toUpperCase()??'',damage,attackBonus,saveDC,savingThrow:abilities[d.saveDcAbilityId-1]?.slice(0,3).toUpperCase()??'',requiresAttack:!!d.requiresAttackRoll,requiresSave:!!d.requiresSavingThrow,name:plainText(d.name),level:d.level??0,school:plainText(d.school),casting,range,duration,components,concentration:!!d.concentration,ritual:!!d.ritual,prepared:!!(entry.prepared||entry.alwaysPrepared),summary,reference:sourceReference(d),restriction:plainText(entry.restriction)});
 }
 const mods=characterModifiers(raw).filter(m=>!m.restriction);
 const skills=new Set(Object.keys(skillAbilities).map(n=>n.toLowerCase().replaceAll(' ','-')));
 const format=(m:Data)=>plainText(m.friendlySubtypeName??String(m.subType??'').replaceAll('-',' '));
 const languages=[...new Set(mods.filter((m:Data)=>m.type==='language').map(format))].join(', ');
 const proficiencies=[...new Set(mods.filter((m:Data)=>m.type==='proficiency'&&!skills.has(m.subType)&&!m.subType?.includes('saving-throws')).map(format))].join(', ');
 // Upstream entity types: armour 174869515, weapon category 660121713, single weapon 1782728300, tool 2103445194.
 const profMods=mods.filter((m:Data)=>m.type==='proficiency');
 const named=(ids:number[])=>[...new Set(profMods.filter((m:Data)=>ids.includes(m.entityTypeId)).map(format))] as string[];
 const categories=named([660121713]),covered=(name:string)=>categories.includes(simpleWeapons.has(name.toLowerCase())?'Simple Weapons':'Martial Weapons');
 const proficiencyGroups={armour:named([174869515]).sort((a,b)=>armourOrder(a)-armourOrder(b)),weapons:[...categories.sort(),...named([1782728300]).filter(n=>!covered(n))],tools:named([2103445194])};
 const unique=featureRows.filter((f,i,a)=>a.findIndex(x=>x.name===f.name&&x.summary===f.summary)===i);
 return {featureRows:unique,classScales,spellRows:spells,languages,proficiencies,proficiencyGroups};
}
