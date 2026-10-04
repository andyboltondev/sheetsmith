type Data = Record<string, any>;
const list = (value: unknown): Data[] => Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : [];
// Every rule modifier the character has. Item modifiers count only while the item is equipped and, when it
// needs attunement, attuned (D&D Beyond also lists modifiers for carried items that are not in effect).
export function characterModifiers(raw: Data): Data[] {
  const mods = ['race', 'class', 'background', 'feat'].flatMap(key => list(raw.modifiers?.[key]));
  for (const item of list(raw.inventory)) if (item.equipped && (!item.definition?.canAttune || item.isAttuned)) mods.push(...list(item.definition?.grantedModifiers));
  return mods;
}
// Sum of unconditional numeric modifiers of one type, for any of the given subtypes.
export const total = (mods: Data[], type: string, subTypes: string[]) =>
  mods.filter(m => m.type === type && subTypes.includes(m.subType) && !m.restriction && typeof m.value === 'number' && Number.isFinite(m.value)).reduce((sum, m) => sum + m.value, 0);
