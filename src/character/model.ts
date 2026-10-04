export const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
export type Ability = typeof abilities[number];
export interface Character {
  identity: { name: string; playerName: string; species: string; background: string; portrait?: string; alignment?: string };
  classes: { name: string; level: number; subclass?: string }[];
  abilities: Record<Ability, { score: number; modifier: number }>;
  experience?: number;
  inspiration?: boolean;
  spellSlots?: {level:number;total:number;used:number|null}[];
  featureUses?: {name:string;remaining:number;maximum:number}[];
  proficiencyBonus: number;
  combat: { armourClass: number | null; maxHP: number | null; speed: number | null; initiative: number; hitDice: string; currentHP?:number|null;temporaryHP?:number|null;hitDiceUsed?:number|null };
  saves: { name: string; bonus: number; proficient: boolean }[];
  skills: { name: string; bonus: number; proficient: boolean; expertise: boolean }[];
  passivePerception: number;
  details?: Record<string, unknown>;
  coins?: Record<string, unknown>;
  inventoryRows?: {name:string;quantity:number;equipped:boolean;category:string;armourType:number|null}[];
  weapons?: {name:string;equipped:boolean;attackBonus:number|null;damage:string;notes:string}[];
  equipment: string;
  currency: string;
  featureRows?: {name:string;summary:string;reference:string;group:string;level:number}[];
  spellRows?: {attackBonus?:number|null;saveDC?:number|null;savingThrow?:string;requiresAttack?:boolean;requiresSave?:boolean;name:string;level:number;summary:string;reference:string;casting:string;range:string;duration:string;components:string;concentration:boolean;ritual:boolean;prepared:boolean;school:string;restriction:string}[];
  languages?: string;
  proficiencies?: string;
  features: string;
  traits: string;
  spells: string;
  warnings: string[];
}
export interface CharacterImporter {
  canImport(input: string): boolean;
  import(input: string): Promise<Character>;
}
