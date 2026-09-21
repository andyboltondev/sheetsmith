import { abilities } from '../../character/model.ts';
import type { Character } from '../../character/model.ts';
import { abilityModifier, proficiencyBonus } from '../../character/calculations.ts';

type ObjectData = Record<string, unknown>;
const obj = (value: unknown): ObjectData => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectData : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;

// Keep all assumptions about the undocumented upstream format in this module.
export function normalise(payload: unknown): Character {
  const raw = obj(obj(payload).data);
  if (!text(raw.name).trim()) throw new Error('D&D Beyond returned unsupported character data.');
  const classes = array(raw.classes).map(value => {
    const entry = obj(value);
    return { name: text(obj(entry.definition).name), level: number(entry.level) ?? 0 };
  });
  const level = classes.reduce((sum, entry) => sum + entry.level, 0);
  if (!classes.length || classes.some(entry => !entry.name || !Number.isInteger(entry.level) || entry.level < 1)) {
    throw new Error('Character class or level is missing or unsupported.');
  }
  const warnings = ['Initial importer: ability modifiers from species, feats, equipment and class features are not yet applied. Verify scores before use.'];
  const scores = Object.fromEntries(abilities.map((ability, index) => {
    const lookup = (key: string) => number(obj(array(raw[key]).find(value => obj(value).id === index + 1)).value);
    const base = lookup('stats');
    const override = lookup('overrideStats');
    if (base === undefined && override === undefined) throw new Error(`Missing ${ability} score.`);
    const score = override ?? ((base ?? 10) + (lookup('bonusStats') ?? 0));
    return [ability, { score, modifier: abilityModifier(score) }];
  })) as Character['abilities'];
  return {
    identity: { name: text(raw.name), playerName: '', species: text(obj(raw.race).fullName), background: text(obj(obj(raw.background).definition).name) },
    classes, abilities: scores, proficiencyBonus: proficiencyBonus(level), warnings,
  };
}
