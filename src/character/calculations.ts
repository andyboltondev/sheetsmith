export function abilityModifier(score: number): number {
  if (!Number.isFinite(score) || score < 1) throw new Error('Invalid ability score.');
  return Math.floor((score - 10) / 2);
}
export function proficiencyBonus(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new Error('Character level must be between 1 and 20.');
  return 2 + Math.floor((level - 1) / 4);
}
