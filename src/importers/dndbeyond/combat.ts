import type { Character } from '../../character/model.ts';
import { characterModifiers } from './modifiers.ts';
type Data = Record<string, any>;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function calculateCombat(raw: Data, scores: Character['abilities'], level: number) {
  const warnings: string[] = [];
  const items: Data[] = (raw.inventory ?? []).filter((i: Data) => i.equipped);
  const mods = characterModifiers(raw);
  const active = mods.filter(m => !m.restriction);
  const bonus = (key: string) => active.filter(m => m.type === 'bonus' && m.subType === key).reduce((s,m) => s + (num(m.value) ? m.value : 0),0);
  const armour = items.filter(i => [1,2,3].includes(i.definition?.armorTypeId));
  const shields = items.filter(i => i.definition?.armorTypeId === 4 || i.definition?.name === 'Shield');
  let ac: number | null = null;
  const dex = scores.dexterity.modifier;
  if (armour.length <= 1 && shields.length <= 1) {
    const a = armour[0]?.definition;
    ac = a ? (num(a.armorClass) ? a.armorClass + (a.armorTypeId === 1 ? dex : a.armorTypeId === 2 ? Math.min(2,dex) : 0) : null) : 10 + dex;
    if (ac !== null) {
      const shield = shields[0]?.definition;
      ac += shield ? (num(shield.armorClass) ? shield.armorClass : 2) : 0;
      ac += bonus('armor-class') + (a ? bonus('armored-armor-class') : bonus('unarmored-armor-class'));
    }
  }
  let hp: number | null = num(raw.baseHitPoints) ? raw.baseHitPoints + scores.constitution.modifier * level + (raw.bonusHitPoints ?? 0) + bonus('hit-points') + bonus('hit-points-per-level') * level : null;
  const walk = raw.race?.weightSpeeds?.normal?.walk;
  let speed: number | null = num(walk) ? walk : null;
  if (num(speed)) {
    speed += bonus('speed') + bonus('walking-speed');
    const a = armour[0]?.definition;
    if (a?.armorTypeId === 3 && num(a.strengthRequirement) && scores.strength.score < a.strengthRequirement && !active.some(m=>m.type==='ignore' && m.subType==='heavy-armor-speed-reduction')) speed -= 10;
    speed = Math.max(0,speed);
  }
  // Do not silently guess alternative AC formulas, conditional bonuses or unknown overrides.
  const affects = (m: Data, kind: string) => kind === 'ac' ? /armor-class/.test(m.subType ?? '') : kind === 'hp' ? /hit-points/.test(m.subType ?? '') : /speed/.test(m.subType ?? '') && m.type !== 'ignore';
  for (const kind of ['ac','hp','speed']) {
    const unresolved = mods.some(m => affects(m,kind) && (m.restriction || m.type !== 'bonus' || !num(m.value)));
    if (unresolved) {
      warnings.push(`Automatic ${kind === 'ac' ? 'AC' : kind === 'hp' ? 'maximum HP' : 'speed'} needs an additional rule or conditional bonus; enter an override if needed.`);
      if (kind==='ac') ac=null;else if(kind==='hp') hp=null;else speed=null;
    }
  }
  if (Array.isArray(raw.characterValues) && raw.characterValues.length) warnings.push('This character has custom adjustments. Check whether they affect the calculated combat values.');
  if (raw.conditions?.length) warnings.push('Active conditions are not included in these normal combat values.');
  if (num(raw.overrideArmorClass)) ac=raw.overrideArmorClass;
  if (num(raw.overrideHitPoints)) hp=raw.overrideHitPoints;
  if (num(raw.race?.weightSpeeds?.override?.walk)) speed=raw.race.weightSpeeds.override.walk;
  if (ac===null && !warnings.some(w=>w.includes('AC'))) warnings.push('AC could not be calculated from the equipped armour.');
  if (hp===null && !warnings.some(w=>w.includes('HP'))) warnings.push('Maximum HP needs the recorded base HP or an explicit override.');
  if (speed===null && !warnings.some(w=>w.includes('speed'))) warnings.push('Walking speed is missing from the character data.');
  return { armourClass:ac,maxHP:hp,speed,warnings };
}
