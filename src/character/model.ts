export const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
export type Ability = typeof abilities[number];
export interface Character {
  identity: { name: string; playerName: string; species: string; background: string };
  classes: { name: string; level: number }[];
  abilities: Record<Ability, { score: number; modifier: number }>;
  proficiencyBonus: number;
  warnings: string[];
}
export interface CharacterImporter {
  canImport(input: string): boolean;
  import(input: string): Promise<Character>;
}
