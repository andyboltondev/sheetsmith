import { readFile } from 'node:fs/promises';
import * as P from 'pdf-lib';
import { loadTemplate } from './templates.ts';
// @ts-expect-error Browser modules are plain JavaScript.
import { generatePdf } from '../../src/pdf/generator.js';
// @ts-expect-error Browser module.
import { blankForPlay } from '../../src/pdf/fresh.js';
import { normalise } from '../../src/importers/dndbeyond/parser.ts';
export const here = (path: string) => new URL(`../../${path}`, import.meta.url);
export const sample = async () => normalise(JSON.parse(await readFile(here('src/sample/martial.json'), 'utf8')));
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
export const spell = (i: number, over: Record<string, unknown> = {}) => ({ name: `Spell ${i}`, level: i % 10, school: 'Evocation', casting: 'Action', range: '60 ft', duration: 'Instantaneous', components: 'V, S, M (a pinch of 50 gp bat guano)', summary: 'An effect that does things to the target creature within range. '.repeat(12), reference: 'PHB 100', prepared: i % 2 === 0, ritual: i % 5 === 0, concentration: i % 3 === 0, requiresSave: i % 2 === 1, requiresAttack: i % 2 === 0, attackBonus: 7, saveDC: 15, savingThrow: 'DEX', restriction: '', damage: '8d6 fire', ability: 'Intelligence', ...over });
// A level-12 wizard with far more of everything than the sample: long spell list, many features and items, full details.
export async function heavy(): Promise<any> {
  const c: any = structuredClone(await sample());
  c.classes = [{ name: 'Wizard', level: 12, subclass: 'Evocation' }];
  c.spellRows = Array.from({ length: 40 }, (_, i) => spell(i));
  c.spellSlots = [1, 2, 3, 4, 5, 6].map(level => ({ level, total: 4, used: 1 }));
  c.featureRows = Array.from({ length: 50 }, (_, i) => ({ name: `Feature ${i}`, group: ['Class features', 'Racial traits', 'Feats'][i % 3], level: 1, summary: i % 7 === 0 ? 'Included in proficiencies.' : 'A long description of what this feature does in play. '.repeat(8), reference: 'PHB 50' }));
  c.inventoryRows = Array.from({ length: 70 }, (_, i) => ({ name: `Item ${i}`, quantity: 1 + i % 5, weight: 1.5, equipped: i % 7 === 0, magic: i % 9 === 0, summary: 'Magical.', rarity: 'rare', attunement: i % 9 === 0 ? 'requires' : '', attuned: i % 18 === 0 }));
  c.carrying = { weight: 105, capacity: 240, pushDragLift: 480 };
  c.details = { ...c.details, backstory: 'Backstory text. '.repeat(300), otherNotes: 'Notes. '.repeat(300), personalityTraits: 'Brave', ideals: 'Honour', bonds: 'Home', flaws: 'Pride', age: '30', height: "5'10", weight: '160', eyes: 'Blue', skin: 'Fair', hair: 'Black', gender: 'F', size: 'Medium', faith: 'Pelor', lifestyle: 'Modest', allies: 'Friends', organizations: 'Guild' };
  c.actions = ['Action', 'Bonus action', 'Reaction', 'Special'].flatMap(g => Array.from({ length: 5 }, (_, i) => ({ name: `${g} feature ${i}`, activation: g, summary: 'You do something remarkable with a long description that wraps onto several lines of the page. '.repeat(2), note: i === 1 ? '1d6' : undefined })));
  c.featureUses = c.actions.slice(0, 8).map((a: any, i: number) => ({ name: a.name, maximum: i + 1, remaining: i, reset: ['Short rest', 'Long rest', 'Dawn'][i % 3] }));
  c.featureUses.push({ name: 'Loose pool', maximum: 14, remaining: 9, reset: 'Long rest' }, { name: 'Loose two', maximum: 3, remaining: 1, reset: 'Short rest' });
  c.senses = ['Darkvision 60 ft.']; c.defences = { resistances: ['fire'], immunities: ['poison'], vulnerabilities: ['cold'], saveNotes: ['Advantage on saving throws against being charmed'] };
  c.classScales = [{ name: 'Action feature 1', value: '2d6' }];
  return c;
}
const load = loadTemplate;
// The options the browser worker builds for a template: the sheet itself plus, for casters, the official spell page.
export async function templateOptions(id: string, character: any) {
  const main = await load(id);
  return { templateId: id, templateBytes: main.bytes, layout: main.layout, ...(character.spellRows?.length ? { spellResource: await load('official-spells') } : {}) };
}
export type Scenario = { name: string; bytes: Uint8Array; warnings: string[] };
// Every sheet style on the sample, plus SheetSmith under the options and content that stress its layout.
export async function exportAll(): Promise<Scenario[]> {
  const base = await sample(), big = await heavy(), out: Scenario[] = [];
  const add = async (name: string, character: any, options: any) => { const { bytes, warnings } = await generatePdf(P, character, options); out.push({ name, bytes, warnings }); };
  const compact = { templateId: 'compact' };
  await add('compact-sample', base, compact);
  await add('compact-modifier-first', base, { ...compact, abilityOrder: 'modifier-first' });
  await add('compact-portrait', base, { ...compact, portrait: PNG, playerName: 'Andy' });
  await add('compact-heavy', big, compact);
  await add('compact-heavy-bare', big, { ...compact, equipmentWeight: false });
  await add('compact-heavy-blank', blankForPlay(big, { hp: true, coins: true, tracking: true }), compact);
  for (const id of ['official-standard', 'official-alternative']) { await add(`${id}-sample`, base, await templateOptions(id, base)); await add(`${id}-heavy`, big, await templateOptions(id, big)); }
  return out;
}
