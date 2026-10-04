import { loadout } from './loadout.ts';
import { plainText } from './text.ts';
import { gameplay } from './gameplay.ts';
import { calculateCombat } from './combat.ts';
import { abilities } from '../../character/model.ts';
import type { Character } from '../../character/model.ts';
import { abilityModifier, proficiencyBonus } from '../../character/calculations.ts';
import { skillAbilities } from '../../character/skills.ts';

type ObjectData = Record<string, unknown>;
const obj = (value: unknown): ObjectData => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectData : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const plain = plainText;
const slug = (value: string) => value.toLowerCase().replaceAll(' ', '-');


// D&D Beyond public /api/config/json alignment IDs (verified 2026-09-25).
const alignmentNames:Record<number,string>={1:'Lawful Good',2:'Neutral Good',3:'Chaotic Good',4:'Lawful Neutral',5:'Neutral',6:'Chaotic Neutral',7:'Lawful Evil',8:'Neutral Evil',9:'Chaotic Evil'};
function alignment(raw:ObjectData):string {
  const explicit=plain(text(raw.alignment)||text(obj(raw.alignment).name));
  if(explicit)return explicit;
  const id=typeof raw.alignmentId==='string'&&/^\d+$/.test(raw.alignmentId)?Number(raw.alignmentId):number(raw.alignmentId);
  return id===undefined?'':alignmentNames[id]??'';
}

// All assumptions about the undocumented upstream format stay in this module.
export function normalise(payload: unknown): Character {
  const raw = obj(obj(payload).data);
  if (!text(raw.name).trim()) throw new Error('D&D Beyond returned unsupported character data.');
  const classes = array(raw.classes).map(value => {
    const entry = obj(value);
    return { name: plain(obj(entry.definition).name), level: number(entry.level) ?? 0, subclass: plain(obj(entry.subclassDefinition).name) };
  });
  const level = classes.reduce((sum, entry) => sum + entry.level, 0);
  if (!classes.length || classes.some(entry => !entry.name || !Number.isInteger(entry.level) || entry.level < 1)) throw new Error('Character class or level is missing or unsupported.');
  const proficiency = proficiencyBonus(level);
  const warnings = [
    'Review this first-build import before play. Conditional bonuses, magic items, custom overrides and advanced class rules may be missing.',
    'Combat values describe your normal equipment. Temporary effects are not automatically activated.',
  ];
  const modifiers = ['race', 'class', 'background', 'feat'].flatMap(key => array(obj(raw.modifiers)[key])).map(obj).filter(m => !m.restriction);
  const bonus = (subType: string) => modifiers.filter(m => m.type === 'bonus' && m.subType === subType).reduce((sum, m) => sum + (number(m.value) ?? 0), 0);
  const has = (type: string, subType: string) => modifiers.some(m => m.type === type && m.subType === subType);
  const scores = Object.fromEntries(abilities.map((ability, index) => {
    const lookup = (key: string) => number(obj(array(raw[key]).find(value => obj(value).id === index + 1)).value);
    const base = lookup('stats'); const override = lookup('overrideStats');
    if (base === undefined && override === undefined) throw new Error(`Missing ${ability} score.`);
    const score = override ?? ((base ?? 10) + (lookup('bonusStats') ?? 0) + bonus(`${ability}-score`));
    return [ability, { score, modifier: abilityModifier(score) }];
  })) as Character['abilities'];
  const combat = calculateCombat(raw, scores, level);
  warnings.push(...combat.warnings);
  const saves = abilities.map(name => ({ name, proficient: has('proficiency', `${name}-saving-throws`), bonus: scores[name].modifier + (has('proficiency', `${name}-saving-throws`) ? proficiency : 0) + bonus(`${name}-saving-throws`) + bonus('saving-throws') }));
  const skills = Object.entries(skillAbilities).map(([name, ability]) => {
    const key = slug(name); const expertise = has('expertise', key); const proficient = expertise || has('proficiency', key);
    return { name, proficient, expertise, bonus: scores[ability].modifier + (expertise ? 2 * proficiency : proficient ? proficiency : 0) + bonus(key) + bonus('ability-checks') };
  });
  const equipment = array(raw.inventory).map(value => { const item = obj(value); return `${number(item.quantity) ?? 1} x ${plain(obj(item.definition).name)}${item.equipped ? ' (equipped)' : ''}`; }).join('\n');
  const play=gameplay(raw,scores,proficiency);
  const features=play.featureRows.map(f=>`${f.name}${f.reference?' ['+f.reference+']':''}: ${f.summary}`).join('\n\n');
  const spells=play.spellRows.map(s=>`${s.level===0?'Cantrip':'Level '+s.level} - ${s.name}${s.prepared?' (prepared)':''}${s.reference?' ['+s.reference+']':''}\n${s.casting} · ${s.range} · ${s.duration}${s.concentration?' (concentration)':''} · ${s.components}${s.ritual?' · Ritual':''}\n${s.summary}${s.restriction?' '+s.restriction:''}`).join('\n\n');
  const traits = Object.entries(obj(raw.traits)).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase())}: ${plain(value)}`).filter(line => !line.endsWith(': ')).join('\n\n');
  // Use the supplied per-level table only for a single class; multiclass slot rules differ.
  const classData = obj(array(raw.classes)[0]);
  const spellRules = obj(obj(classData.subclassDefinition).spellRules ?? obj(classData.definition).spellRules);
  const slotRow = classes.length === 1 ? array(array(spellRules.levelSpellSlots)[classes[0].level]) : [];
  const spellSlots = slotRow.map((total, i) => ({
    level: i + 1, total: number(total) ?? 0,
    used: number(obj(array(raw.spellSlots).find(slot => obj(slot).level === i + 1)).used) ?? null,
  })).filter(slot => slot.total > 0);
  const featureUses = Object.values(obj(raw.actions)).flatMap(array).map(obj).flatMap(action => {
    const use = obj(action.limitedUse), maximum = number(use.maxUses), used = number(use.numberUsed);
    if (maximum === undefined || maximum < 0 || used === undefined || used < 0 || use.statModifierUsesId || use.useProficiencyBonus) return [];
    return [{ name: plain(action.name), maximum, remaining: Math.max(0, maximum - used) }];
  });
  return {
    identity: { name: plain(raw.name), alignment: alignment(raw), playerName: '', species: plain(obj(raw.race).fullName), background: plain(obj(obj(raw.background).definition).name), portrait: text(obj(raw.decorations).avatarUrl) },
    experience: number(raw.currentXp), inspiration: raw.inspiration===true,
    spellSlots, featureUses,
    classes, abilities: scores, proficiencyBonus: proficiency,
    ...play, ...loadout(raw,scores,proficiency),
    details: Object.fromEntries(Object.entries({ ...obj(raw.traits), ...obj(raw.notes), age: raw.age, height: raw.height, weight: raw.weight, eyes: raw.eyes, skin: raw.skin, hair: raw.hair }).map(([key,value])=>[key,plain(value)])),
    coins: obj(raw.currencies),
    combat: { currentHP: combat.maxHP!==null&&number(raw.removedHitPoints)!==undefined?Math.max(0,combat.maxHP-number(raw.removedHitPoints)!):null, temporaryHP:number(raw.temporaryHitPoints)??null,hitDiceUsed:array(raw.classes).every(c=>number(obj(c).hitDiceUsed)!==undefined)?array(raw.classes).reduce<number>((sum,c)=>sum+number(obj(c).hitDiceUsed)!,0):null, armourClass: combat.armourClass, maxHP: combat.maxHP, speed: combat.speed, initiative: scores.dexterity.modifier + bonus('initiative'), hitDice: array(raw.classes).map(value => { const entry = obj(value); return `${entry.level}d${number(obj(entry.definition).hitDice) ?? '?'}`; }).join(' + ') },
    saves, skills, passivePerception: 10 + (skills.find(skill => skill.name === 'Perception')?.bonus ?? 0) + bonus('passive-perception'),
    equipment, currency: ['cp','sp','ep','gp','pp'].map(key => `${number(obj(raw.currencies)[key]) ?? 0} ${key.toUpperCase()}`).join('   '), features, traits, spells, warnings,
  };
}
