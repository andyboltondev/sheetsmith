import { abilities } from '../../character/model.ts';
import type { Character } from '../../character/model.ts';
import { abilityModifier, proficiencyBonus } from '../../character/calculations.ts';
import { skillAbilities } from '../../character/skills.ts';

type ObjectData = Record<string, unknown>;
const obj = (value: unknown): ObjectData => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectData : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const plain = (value: unknown) => text(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const slug = (value: string) => value.toLowerCase().replaceAll(' ', '-');

// All assumptions about the undocumented upstream format stay in this module.
export function normalise(payload: unknown): Character {
  const raw = obj(obj(payload).data);
  if (!text(raw.name).trim()) throw new Error('D&D Beyond returned unsupported character data.');
  const classes = array(raw.classes).map(value => {
    const entry = obj(value);
    return { name: text(obj(entry.definition).name), level: number(entry.level) ?? 0 };
  });
  const level = classes.reduce((sum, entry) => sum + entry.level, 0);
  if (!classes.length || classes.some(entry => !entry.name || !Number.isInteger(entry.level) || entry.level < 1)) throw new Error('Character class or level is missing or unsupported.');
  const proficiency = proficiencyBonus(level);
  const warnings = [
    'Review this first-build import before play. Conditional bonuses, magic items, custom overrides and advanced class rules may be missing.',
    'Armour Class and maximum HP are left blank unless an explicit override is supplied. Enter verified values below. Attacks and spellcasting totals can be added in the editable PDF.',
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
  const saves = abilities.map(name => ({ name, proficient: has('proficiency', `${name}-saving-throws`), bonus: scores[name].modifier + (has('proficiency', `${name}-saving-throws`) ? proficiency : 0) + bonus(`${name}-saving-throws`) + bonus('saving-throws') }));
  const skills = Object.entries(skillAbilities).map(([name, ability]) => {
    const key = slug(name); const expertise = has('expertise', key); const proficient = expertise || has('proficiency', key);
    return { name, proficient, expertise, bonus: scores[ability].modifier + (expertise ? 2 * proficiency : proficient ? proficiency : 0) + bonus(key) + bonus('ability-checks') };
  });
  const equipment = array(raw.inventory).map(value => { const item = obj(value); return `${number(item.quantity) ?? 1} x ${text(obj(item.definition).name)}${item.equipped ? ' (equipped)' : ''}`; }).join('\n');
  const featureGroups = [array(obj(raw.race).racialTraits), array(raw.feats), ...array(raw.classes).map(value => array(obj(value).classFeatures))];
  const features = featureGroups.flat().map(value => { const entry = obj(value); const definition = obj(entry.definition ?? entry); return [text(definition.name), plain(definition.description)].filter(Boolean).join(': '); }).filter(Boolean).join('\n\n');
  const spellEntries = [...array(raw.classSpells).flatMap(value => array(obj(value).spells)), ...Object.values(obj(raw.spells)).flatMap(array)];
  const spells = [...new Set(spellEntries.map(value => { const spell = obj(value); const definition = obj(spell.definition); return `${number(definition.level) === 0 ? 'Cantrip' : `Level ${number(definition.level) ?? '?'}`} - ${text(definition.name)}${spell.prepared ? ' (prepared)' : ''}`; }))].join('\n');
  const traits = Object.entries(obj(raw.traits)).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase())}: ${plain(value)}`).filter(line => !line.endsWith(': ')).join('\n\n');
  return {
    identity: { name: text(raw.name), playerName: '', species: text(obj(raw.race).fullName), background: text(obj(obj(raw.background).definition).name), portrait: text(obj(raw.decorations).avatarUrl) },
    classes, abilities: scores, proficiencyBonus: proficiency,
    combat: { armourClass: number(raw.overrideArmorClass) ?? null, maxHP: number(raw.overrideHitPoints) ?? null, speed: number(obj(obj(obj(raw.race).weightSpeeds).normal).walk) ?? null, initiative: scores.dexterity.modifier + bonus('initiative'), hitDice: array(raw.classes).map(value => { const entry = obj(value); return `${entry.level}d${number(obj(entry.definition).hitDice) ?? '?'}`; }).join(' + ') },
    saves, skills, passivePerception: 10 + (skills.find(skill => skill.name === 'Perception')?.bonus ?? 0) + bonus('passive-perception'),
    equipment, currency: ['cp','sp','ep','gp','pp'].map(key => `${number(obj(raw.currencies)[key]) ?? 0} ${key.toUpperCase()}`).join('   '), features, traits, spells, warnings,
  };
}
