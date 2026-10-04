import { gameplayText } from './concise.ts';
import type { Character } from '../../character/model.ts';
type Data=Record<string,any>;
import { plainText } from './text.ts';
export { plainText } from './text.ts';
export function sourceReference(d:Data):string {
 if(d.isHomebrew)return 'Homebrew';
 const sources=d.sources??[];
 const phb=sources.find((s:Data)=>s.sourceId===2&&Number.isInteger(s.pageNumber)&&s.pageNumber>0);
 if(phb)return `PHB (2014), p. ${phb.pageNumber}`;
 if(d.sourceId===2&&Number.isInteger(d.sourcePageNumber)&&d.sourcePageNumber>0)return `PHB (2014), p. ${d.sourcePageNumber}`;
 const basic=sources.find((s:Data)=>s.sourceId===1&&Number.isInteger(s.pageNumber)&&s.pageNumber>0);
 return basic?`Basic Rules (2014), p. ${basic.pageNumber}`:'';
}
function resolveSnippet(text:string,level:number,scale:Data,scores:Character['abilities'],prof:number):string {
 const short:Record<string,string>={str:'strength',dex:'dexterity',con:'constitution',int:'intelligence',wis:'wisdom',cha:'charisma'};
 return text.replace(/\{\{([^}]+)\}\}/g,(_,token:string)=>{
  if(token==='classlevel')return String(level);
  if(token==='proficiency')return String(prof);
  if(token==='scalevalue')return String(scale?.fixedValue??scale?.dice?.diceString??'{{scalevalue}}');
  const [kind,ability]=token.split(':');const a=scores[short[ability] as keyof typeof scores];
  if(a&&kind==='savedc')return String(8+prof+a.modifier);
  if(a&&kind==='spellattack')return `${prof+a.modifier>=0?'+':''}${prof+a.modifier}`;
  if(a&&kind==='modifier')return String(a.modifier);
  return `{{${token}}}`;
 });
}
export function gameplay(raw:Data,scores:Character['abilities'],prof:number){
 const featureRows:NonNullable<Character['featureRows']>=[];
 const skip=new Set(['Proficiencies','Hit Points','Equipment','Ability Score Increase','Ability Score Improvement','Age','Languages','Speed','Size','Martial Archetype','Tool Proficiency','Dwarven Combat Training','Dwarven Armor Training']);
 const append=(entry:Data,level:number,group:string)=>{
  const d=entry.definition??entry;if(!d.name||skip.has(d.name)||d.hideInSheet)return;
  if(d.requiredLevel>level)return;
  let summary=resolveSnippet(plainText(d.snippet),level,entry.levelScale,scores,prof);
  if(!summary||summary.includes('{{'))summary=plainText(d.description);
  summary=gameplayText(summary,sourceReference(d),level).replace(/\b1 times\b/g,'once');
  if(sourceReference(d)==='PHB (2014), p. 75'&&d.name==='Weapon Bond')summary='1-hour ritual; bond up to two weapons. Cannot be disarmed unless incapacitated. Bonus action: summon one bonded weapon from the same plane.';
  if(sourceReference(d)==='PHB (2014), p. 75'&&d.name==='Spellcasting')summary=`INT spellcasting: save DC ${8+prof+scores.intelligence.modifier}; spell attack ${prof+scores.intelligence.modifier>=0?'+':''}${prof+scores.intelligence.modifier}. Use known wizard spells.`;
  if(!summary)return;
  featureRows.push({name:plainText(d.name),summary,reference:sourceReference(d),group,level:d.requiredLevel??0});
 };
 for(const f of raw.race?.racialTraits??[])append(f,20,'Racial traits');
 for(const f of raw.feats??[])append(f,20,'Feats');
 for(const c of raw.classes??[]){const baseIds=new Set((c.definition?.classFeatures??[]).map((f:Data)=>(f.definition??f).id));const ids=new Set((c.subclassDefinition?.classFeatures??[]).map((f:Data)=>(f.definition??f).id).filter((id:number)=>!baseIds.has(id)));for(const f of c.classFeatures??[])append(f,c.level,ids.has((f.definition??f).id)?'Subclass features':'Class features');}
 // Selected options (such as fighting styles) replace generic choice instructions.
 for(const group of Object.values(raw.options??{}) as any[])for(const o of group??[]){if(o.definition?.name){const parent=(raw.classes??[]).flatMap((c:Data)=>c.classFeatures??[]).find((f:Data)=>f.definition?.id===o.componentId);append({...o,definition:{...o.definition,sources:o.definition.sources?.length?o.definition.sources:parent?.definition?.sources}},20,'Class features');}}
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
  const abilityId=entry.spellCastingAbilityId??entry._ability;const keyAbility=['strength','dexterity','constitution','intelligence','wisdom','charisma'][abilityId-1] as keyof typeof scores;const spellModifier=scores[keyAbility]?.modifier;
  const attackBonus=spellModifier===undefined?null:prof+spellModifier;const saveDC=entry.overrideSaveDc??(spellModifier===undefined?null:8+prof+spellModifier);
  spells.push({attackBonus,saveDC,savingThrow:['STR','DEX','CON','INT','WIS','CHA'][d.saveDcAbilityId-1]??'',requiresAttack:!!d.requiresAttackRoll,requiresSave:!!d.requiresSavingThrow,name:plainText(d.name),level:d.level??0,school:plainText(d.school),casting,range,duration,components,concentration:!!d.concentration,ritual:!!d.ritual,prepared:!!(entry.prepared||entry.alwaysPrepared),summary,reference:sourceReference(d),restriction:plainText(entry.restriction)});
 }
 const mods=['race','class','background','feat'].flatMap(k=>raw.modifiers?.[k]??[]).filter((m:Data)=>!m.restriction);
 const skills=new Set(['acrobatics','animal-handling','arcana','athletics','deception','history','insight','intimidation','investigation','medicine','nature','perception','performance','persuasion','religion','sleight-of-hand','stealth','survival']);
 const format=(m:Data)=>plainText(m.friendlySubtypeName??String(m.subType??'').replaceAll('-',' '));
 const languages=[...new Set(mods.filter((m:Data)=>m.type==='language').map(format))].join(', ');
 const proficiencies=[...new Set(mods.filter((m:Data)=>m.type==='proficiency'&&!skills.has(m.subType)&&!m.subType?.includes('saving-throws')).map(format))].join(', ');
 const unique=featureRows.filter((f,i,a)=>a.findIndex(x=>x.name===f.name&&x.summary===f.summary)===i);
 return {featureRows:unique,spellRows:spells,languages,proficiencies};
}
