import { loadout, attackRows } from './loadout.ts';
import { defences } from './defences.ts';
import { plainText } from './text.ts';
import { gameplay } from './gameplay.ts';
import { calculateCombat } from './combat.ts';
import { characterModifiers } from './modifiers.ts';
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
const resetNames:Record<number,string>={1:'Short rest',2:'Long rest',3:'Dawn'};
const sizeNames:Record<number,string>={2:'Tiny',3:'Small',4:'Medium',5:'Large',6:'Huge',7:'Gargantuan'};
const sizeMultipliers:Record<number,number>={2:.5,5:2,6:4,7:8};
// PHB (2014) multiclass spellcaster table, p. 165: slots per spell level by combined caster level.
const multiclassSlots=[[],[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
// D&D Beyond flags casting per class and subclass (Fighter carries the Eldritch Knight table even for a Champion).
// Older exports without the flags fall back to the class table.
const casts=(entry:ObjectData)=>{const own=obj(entry.definition).canCastSpells,sub=obj(entry.subclassDefinition).canCastSpells;return own===true||sub===true||(own===undefined&&sub===undefined);};
const spellRulesOf=(entry:ObjectData)=>obj(obj(entry.subclassDefinition).spellRules??obj(entry.definition).spellRules);
const activationName=(action:ObjectData):'Action'|'Bonus action'|'Reaction'|'Special'=>({1:'Action',3:'Bonus action',4:'Reaction'} as const)[number(obj(action.activation).activationType) as 1|3|4]??'Special';
function alignment(raw:ObjectData):string {
  const explicit=plain(text(raw.alignment)||text(obj(raw.alignment).name));
  if(explicit)return explicit;
  const id=typeof raw.alignmentId==='string'&&/^\d+$/.test(raw.alignmentId)?Number(raw.alignmentId):number(raw.alignmentId);
  return id===undefined?'':alignmentNames[id]??'';
}

// Upstream lists occasionally hold nulls or odd types; drop them once here so every reader below can rely on the shape.
// Returns a shallow copy, never touching the source payload.
function tidy(raw: ObjectData): ObjectData {
  const objects = (value: unknown) => array(value).filter(item => item !== null && typeof item === 'object' && !Array.isArray(item)) as ObjectData[];
  const modifiers = Object.fromEntries(Object.entries(obj(raw.modifiers)).map(([key, list]) => [key, objects(list).map(m => typeof m.subType === 'string' ? m : { ...m, subType: '' })]));
  return { ...raw, inventory: objects(raw.inventory), modifiers };
}
// All assumptions about the undocumented upstream format stay in this module.
export function normalise(payload: unknown): Character {
  const raw = tidy(obj(obj(payload).data));
  if (!text(raw.name).trim()) throw new Error('D&D Beyond returned unsupported character data.');
  const classes = array(raw.classes).map(value => {
    const entry = obj(value);
    return { name: plain(obj(entry.definition).name), level: number(entry.level) ?? 0, subclass: plain(obj(entry.subclassDefinition).name) };
  });
  const level = classes.reduce((sum, entry) => sum + entry.level, 0);
  if (!classes.length || classes.some(entry => !entry.name || !Number.isInteger(entry.level) || entry.level < 1)) throw new Error('Character class or level is missing or unsupported.');
  const proficiency = proficiencyBonus(level);
  // Only problems specific to this character; the general review caveat is shown by the page.
  const warnings: string[] = [];
  const modifiers = characterModifiers(raw).filter(m => !m.restriction);
  const bonus = (subType: string) => modifiers.filter(m => m.type === 'bonus' && m.subType === subType).reduce((sum, m) => sum + (number(m.value) ?? 0), 0);
  const has = (type: string, subType: string) => modifiers.some(m => m.type === type && m.subType === subType);
  // Jack of All Trades (half, rounded down) and Remarkable Athlete (half, rounded up) apply to checks without proficiency.
  const partial = (key: string, ability: string) => { const applies = (type: string) => [key, 'ability-checks', `${ability}-ability-checks`].some(s => has(type, s)); return Math.max(applies('half-proficiency') ? Math.floor(proficiency / 2) : 0, applies('half-proficiency-round-up') ? Math.ceil(proficiency / 2) : 0); };
  const scores = Object.fromEntries(abilities.map((ability, index) => {
    const lookup = (key: string) => number(obj(array(raw[key]).find(value => obj(value).id === index + 1)).value);
    const base = lookup('stats'); const override = lookup('overrideStats');
    if (base === undefined && override === undefined) throw new Error(`Missing ${ability} score.`);
    // Items such as a Headband of Intellect set a minimum score.
    const floor = Math.max(0, ...modifiers.filter(m => m.type === 'set' && m.subType === `${ability}-score`).map(m => number(m.value) ?? 0));
    const score = override ?? Math.max(floor, (base ?? 10) + (lookup('bonusStats') ?? 0) + bonus(`${ability}-score`));
    return [ability, { score, modifier: abilityModifier(score) }];
  })) as Character['abilities'];
  const combat = calculateCombat(raw, scores, level);
  warnings.push(...combat.warnings);
  const saves = abilities.map(name => ({ name, proficient: has('proficiency', `${name}-saving-throws`), bonus: scores[name].modifier + (has('proficiency', `${name}-saving-throws`) ? proficiency : 0) + bonus(`${name}-saving-throws`) + bonus('saving-throws') }));
  const skills = Object.entries(skillAbilities).map(([name, ability]) => {
    const key = slug(name); const expertise = has('expertise', key); const proficient = expertise || has('proficiency', key);
    return { name, proficient, expertise, bonus: scores[ability].modifier + (expertise ? 2 * proficiency : proficient ? proficiency : partial(key, ability)) + bonus(key) + bonus('ability-checks') + bonus(`${ability}-ability-checks`) };
  });
  const equipment = array(raw.inventory).map(value => { const item = obj(value); return `${number(item.quantity) ?? 1} x ${plain(obj(item.definition).name)}${item.equipped ? ' (equipped)' : ''}`; }).join('\n');
  const play=gameplay(raw,scores,proficiency);
  const gear=loadout(raw,scores,proficiency);
  const skillBonus=(name:string)=>skills.find(skill=>skill.name===name)?.bonus??0;
  // Traits whose effect is only a proficiency share one line in the text summary.
  const covered=play.featureRows.filter(f=>f.summary==='Included in proficiencies.'),coveredRefs=[...new Set(covered.map(f=>f.reference).filter(Boolean))];
  const features=[...play.featureRows.filter(f=>!covered.includes(f)).map(f=>`${f.name}${f.reference?' ['+f.reference+']':''}: ${f.summary}`),
   ...(covered.length?[`${covered.map(f=>f.name).join(', ')}${coveredRefs.length?' ['+coveredRefs.join('; ')+']':''}: included in proficiencies.`]:[])].join('\n\n');
  const spells=play.spellRows.map(s=>`${s.level===0?'Cantrip':'Level '+s.level} - ${s.name}${s.prepared?' (prepared)':''}${s.reference?' ['+s.reference+']':''}\n${s.casting} · ${s.range} · ${s.duration}${s.concentration?' (concentration)':''} · ${s.components}${s.ritual?' · Ritual':''}\n${s.summary}${s.restriction?' '+s.restriction:''}`).join('\n\n');
  const traits = Object.entries(obj(raw.traits)).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase())}: ${plain(value)}`).filter(line => !line.endsWith(': ')).join('\n\n');
  // One spellcasting class uses its own table. Several combine caster levels on the PHB multiclass table,
  // with D&D Beyond's divisor and rounding (third casters 3, half casters 2; Artificer rounds up); Pact Magic stays separate.
  const casters = array(raw.classes).map(obj).filter(entry => casts(entry) && array(spellRulesOf(entry).levelSpellSlots).length);
  const slotted = casters.filter(entry => plain(obj(entry.definition).name) !== 'Warlock');
  let slotRow: unknown[] = [];
  if (casters.length === 1 || slotted.length === 1) { const only = slotted[0] ?? casters[0]; slotRow = array(array(spellRulesOf(only).levelSpellSlots)[number(only.level) ?? 0]); }
  else if (slotted.length > 1 && slotted.every(entry => (number(spellRulesOf(entry).multiClassSpellSlotDivisor) ?? 0) > 0)) {
    const casterLevel = slotted.reduce((sum, entry) => { const rules = spellRulesOf(entry), share = (number(entry.level) ?? 0) / number(rules.multiClassSpellSlotDivisor)!; return sum + (rules.multiClassSpellSlotRounding === 2 ? Math.ceil(share) : Math.floor(share)); }, 0);
    slotRow = multiclassSlots[Math.min(20, casterLevel)];
  } else if (slotted.length > 1) warnings.push('Multiclass spell slots could not be combined from the character data; enter them on the sheet.');
  const spellSlots = slotRow.map((total, i) => ({
    level: i + 1, total: number(total) ?? 0,
    used: number(obj(array(raw.spellSlots).find(slot => obj(slot).level === i + 1)).used) ?? null,
  })).filter(slot => slot.total > 0);
  const featureUses = Object.values(obj(raw.actions)).flatMap(array).map(obj).flatMap(action => {
    const use = obj(action.limitedUse), maximum = number(use.maxUses), used = number(use.numberUsed);
    if (maximum === undefined || maximum < 0 || used === undefined || used < 0 || use.statModifierUsesId || use.useProficiencyBonus) return [];
    return [{ name: plain(action.name), maximum, remaining: Math.max(0, maximum - used), reset: resetNames[number(use.resetType) ?? 0] ?? '', activation: activationName(action) }];
  });
  // Feature actions grouped by what they cost; summaries reuse the concise feature text where there is one.
  const actions = Object.values(obj(raw.actions)).flatMap(array).map(obj).filter(action => plain(action.name)).map(action => {
    const name = plain(action.name), use = featureUses.find(u => u.name === name);
    const summary = play.featureRows.find(f => f.name === name)?.summary || plain(action.snippet) || plain(action.description);
    return { name, activation: activationName(action), summary, uses: use ? `${use.maximum} / ${use.reset || 'rest'}` : undefined };
  });
  const gearRows = gear.inventoryRows, prefs = obj(raw.preferences), coins = obj(raw.currencies);
  const coinWeight = prefs.ignoreCoinWeight === false ? ['cp','sp','ep','gp','pp'].reduce((n, k) => n + (number(coins[k]) ?? 0), 0) / 50 : 0;
  const sizeId = number(obj(raw.race).sizeId) ?? 4, capacity = scores.strength.score * 15 * (sizeMultipliers[sizeId] ?? 1);
  const carrying = { weight: Math.round((gearRows.reduce((n, r) => n + (r.weight ?? 0), 0) + coinWeight) * 100) / 100, capacity, pushDragLift: capacity * 2 };
  const movement = obj(obj(obj(raw.race).weightSpeeds).normal);
  const speeds = ['fly', 'swim', 'climb', 'burrow'].filter(k => (number(movement[k]) ?? 0) > 0).map(k => `${k[0].toUpperCase()}${k.slice(1)} ${movement[k]} ft.`);
  const noisyArmour = gearRows.find(r => r.equipped && r.stealthDisadvantage);
  if (noisyArmour) { const stealth = skills.find(s => s.name === 'Stealth'); if (stealth) Object.assign(stealth, { disadvantage: `Disadvantage (${noisyArmour.name})` }); }
  return {
    identity: { name: plain(raw.name), alignment: alignment(raw), playerName: plain(text(raw.username)), species: plain(obj(raw.race).fullName), background: plain(obj(obj(raw.background).definition).name), portrait: text(obj(raw.decorations).avatarUrl) },
    experience: number(raw.currentXp), advancement: obj(raw.preferences).progressionType === 1 ? 'milestone' : 'xp', inspiration: raw.inspiration===true,
    spellSlots, featureUses, actions, carrying, speeds,
    classes, abilities: scores, proficiencyBonus: proficiency,
    ...play, ...gear, attacks: attackRows(gear.weapons, play.spellRows, scores, proficiency, classes), ...defences(raw),
    passiveInsight: 10 + skillBonus('Insight') + bonus('passive-insight'), passiveInvestigation: 10 + skillBonus('Investigation') + bonus('passive-investigation'),
    details: Object.fromEntries(Object.entries({ ...obj(raw.traits), ...obj(raw.notes), gender: raw.gender, age: raw.age, size: sizeNames[number(obj(raw.race).sizeId) ?? 0], height: raw.height, weight: raw.weight, eyes: raw.eyes, skin: raw.skin, hair: raw.hair, faith: raw.faith, lifestyle: obj(raw.lifestyle).name }).map(([key,value])=>[key,plain(value)])),
    coins: obj(raw.currencies),
    combat: { currentHP: combat.maxHP!==null&&number(raw.removedHitPoints)!==undefined?Math.max(0,combat.maxHP-number(raw.removedHitPoints)!):null, temporaryHP:number(raw.temporaryHitPoints)??null,hitDiceUsed:array(raw.classes).every(c=>number(obj(c).hitDiceUsed)!==undefined)?array(raw.classes).reduce<number>((sum,c)=>sum+number(obj(c).hitDiceUsed)!,0):null, armourClass: combat.armourClass, maxHP: combat.maxHP, speed: combat.speed, initiative: scores.dexterity.modifier + bonus('initiative') + partial('initiative', 'dexterity'), hitDice: array(raw.classes).map(value => { const entry = obj(value); return `${entry.level}d${number(obj(entry.definition).hitDice) ?? '?'}`; }).join(' + ') },
    saves, skills, passivePerception: 10 + skillBonus('Perception') + bonus('passive-perception'),
    equipment, currency: ['cp','sp','ep','gp','pp'].map(key => `${number(obj(raw.currencies)[key]) ?? 0} ${key.toUpperCase()}`).join('   '), features, traits, spells, warnings,
  };
}
