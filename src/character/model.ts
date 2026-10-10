export const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
export type Ability = typeof abilities[number];
export interface Character {
  identity: { name: string; playerName: string; species: string; background: string; portrait?: string; alignment?: string };
  classes: { name: string; level: number; subclass?: string }[];
  abilities: Record<Ability, { score: number; modifier: number }>;
  experience?: number;
  // 'milestone' campaigns have no meaningful XP total.
  advancement?: 'milestone'|'xp';
  inspiration?: boolean;
  spellSlots?: {level:number;total:number;used:number|null}[];
  featureUses?: {name:string;remaining:number;maximum:number;reset?:string;activation?:string}[];
  // Things the character can do in combat, grouped by the action they cost.
  actions?: {name:string;activation:'Action'|'Bonus action'|'Reaction'|'Special';summary:string;uses?:string}[];
  proficiencyBonus: number;
  combat: { armourClass: number | null; maxHP: number | null; speed: number | null; initiative: number; hitDice: string; currentHP?:number|null;temporaryHP?:number|null;hitDiceUsed?:number|null };
  saves: { name: string; bonus: number; proficient: boolean }[];
  skills: { name: string; bonus: number; proficient: boolean; expertise: boolean; disadvantage?: string }[];
  passivePerception: number;
  details?: Record<string, unknown>;
  coins?: Record<string, unknown>;
  // Magic items also carry their rarity, whether they need attunement and a short effect.
  inventoryRows?: {name:string;quantity:number;equipped:boolean;category:string;armourType:number|null;armourClass?:number|null;weight?:number;attuned?:boolean;stealthDisadvantage?:boolean;magic?:boolean;rarity?:string;attunement?:boolean;summary?:string}[];
  // Pounds; capacity follows the standard 15 × STR rule with size multipliers.
  carrying?: {weight:number;capacity:number;pushDragLift:number};
  weapons?: {name:string;equipped:boolean;ranged?:boolean;attackBonus:number|null;damage:string;notes:string}[];
  // Rows for the attack table: equipped weapons, damaging cantrips, unarmed strike, then carried weapons.
  attacks?: {name:string;source:'weapon'|'spell'|'unarmed';attackBonus:number|null;save?:string;damage:string;notes:string}[];
  senses?: string[];
  // Movement other than walking, from the species ("Swim 30 ft.").
  speeds?: string[];
  passiveInsight?: number;
  passiveInvestigation?: number;
  defences?: {resistances:string[];immunities:string[];vulnerabilities:string[];saveNotes:string[]};
  equipment: string;
  currency: string;
  featureRows?: {name:string;summary:string;reference:string;group:string;level:number;parent?:string}[];
  // Per-level class values from D&D Beyond (Sneak Attack 2d6, Martial Arts 1d4), by feature name.
  classScales?: {name:string;value:string}[];
  spellRows?: {ability?:string;damage?:string;attackBonus?:number|null;saveDC?:number|null;savingThrow?:string;requiresAttack?:boolean;requiresSave?:boolean;name:string;level:number;summary:string;reference:string;casting:string;range:string;duration:string;components:string;concentration:boolean;ritual:boolean;prepared:boolean;school:string;restriction:string}[];
  languages?: string;
  proficiencies?: string;
  proficiencyGroups?: {armour:string[];weapons:string[];tools:string[]};
  features: string;
  traits: string;
  spells: string;
  warnings: string[];
}
export interface CharacterImporter {
  canImport(input: string): boolean;
  import(input: string): Promise<Character>;
}
