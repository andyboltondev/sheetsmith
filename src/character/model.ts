export const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
export type Ability = typeof abilities[number];
export interface Character {
  identity: { name: string; playerName: string; species: string; background: string; portrait?: string; alignment?: string };
  classes: { name: string; level: number }[];
  abilities: Record<Ability, { score: number; modifier: number }>;
  proficiencyBonus: number;
  combat: { armourClass: number | null; maxHP: number | null; speed: number | null; initiative: number; hitDice: string };
  saves: { name: string; bonus: number; proficient: boolean }[];
  skills: { name: string; bonus: number; proficient: boolean; expertise: boolean }[];
  passivePerception: number;
  equipment: string;
  currency: string;
  features: string;
  traits: string;
  spells: string;
  warnings: string[];
}
export interface CharacterImporter {
  canImport(input: string): boolean;
  import(input: string): Promise<Character>;
}
