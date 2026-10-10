import { signed } from './format.js';
const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Numbers that class features hand the player and that the character data does not carry directly: D&D Beyond's
// scale values where it provides them, otherwise the 2014 Player's Handbook class tables. Returns [{ label, value }]
// in the order they should be read. Resource pools (Rage, Ki, Sorcery Points…) are tracked with limited uses instead.
export function classStats(character) {
  const out = [], mod = k => character.abilities?.[k]?.modifier ?? 0, prof = character.proficiencyBonus ?? 2;
  const scale = (...names) => character.classScales?.find(v => names.some(n => norm(v.name) === norm(n)))?.value;
  for (const cls of character.classes ?? []) {
    const lvl = cls.level || 0, kind = norm(cls.name), sub = norm(cls.subclass ?? '');
    const tier = steps => steps.reduce((value, [at, v]) => lvl >= at ? v : value, '');
    const add = (label, value) => { if (value !== '' && value != null) out.push({ label, value: String(value) }); };
    if (kind === 'barbarian') {
      add('Rage damage', signed(tier([[1, 2], [9, 3], [16, 4]])));
      const crit = tier([[9, 1], [13, 2], [17, 3]]);
      if (crit) add('Brutal Critical', `${crit} extra ${crit === 1 ? 'die' : 'dice'}`);
    }
    if (kind === 'bard') add('Song of Rest', scale('Song of Rest') ?? tier([[2, 'd6'], [9, 'd8'], [13, 'd10'], [17, 'd12']]));
    if (kind === 'druid' && lvl >= 2) add('Wild Shape max CR', sub.includes('moon') ? String(lvl >= 6 ? Math.floor(lvl / 3) : 1) : tier([[2, '1/4'], [4, '1/2'], [8, '1']]));
    if (kind === 'fighter') {
      // PHB notation: Extra Attack (2) at 11th level means two extra attacks.
      const extra = tier([[5, 1], [11, 2], [20, 3]]);
      if (extra) add('Extra Attack', `+${extra}`);
      if (sub === 'battle master' && lvl >= 3) {
        add('Superiority die', scale('Combat Superiority', 'Superiority Dice') ?? tier([[3, 'd8'], [10, 'd10'], [18, 'd12']]));
        add('Maneuver DC', 8 + prof + Math.max(mod('strength'), mod('dexterity')));
      }
      if (sub === 'gunslinger') add('Trick Shot DC', 8 + prof + mod('dexterity'));
    }
    if (kind === 'monk') add('Martial Arts die', scale('Martial Arts') ?? tier([[1, 'd4'], [5, 'd6'], [11, 'd8'], [17, 'd10']]));
    if (kind === 'pugilist') add('Fisticuffs die', scale('Fisticuffs'));
    if (kind === 'rogue') add('Sneak Attack', scale('Sneak Attack') ?? `${Math.ceil(lvl / 2)}d6`);
    if (kind === 'warlock') {
      const spells = character.spellRows ?? [];
      for (const level of [6, 7, 8, 9]) { const spell = spells.find(s => s.level === level); if (spell) add(`${level}th-level Arcanum`, spell.name); }
    }
  }
  // Choices that are counted on the class sheets: metamagic options and invocations known.
  const chosen = parent => (character.featureRows ?? []).filter(f => f.parent && norm(f.parent) === norm(parent)).length;
  for (const [label, parent] of [['Metamagic known', 'Metamagic'], ['Invocations known', 'Eldritch Invocations']]) { const count = chosen(parent); if (count) out.push({ label, value: String(count) }); }
  const cantrips = (character.spellRows ?? []).filter(s => s.level === 0).length;
  if (cantrips) out.push({ label: 'Cantrips known', value: String(cantrips) });
  return out;
}
