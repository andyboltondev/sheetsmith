import { ordinal } from './format.js';
// Optional "fill in at the table" export: leave values that change during play blank,
// so players can pencil them in. Box fields become empty; inline text shows `__`.
export const BLANK = '__';
const COINS = ['pp','gp','ep','sp','cp'];
// Every item count in running text becomes a blank to write in.
const uncounted = text => String(text??'').replace(/^(\d+) x /gm,`${BLANK} × `);

export function blankForPlay(character, { hp=false, coins=false, tracking=false, proficiencies=false, advancement=false, equipment=false, spells=false, quantities=false }={}) {
  const c = structuredClone(character);
  c.blanked = { hp, coins, tracking, proficiencies, advancement, equipment, spells, quantities };
  if (hp) c.combat.currentHP = null;
  if (coins) { c.coins = Object.fromEntries(COINS.map(k=>[k,null])); c.currency = ''; }
  // XP, or the Milestone label, becomes an empty box to fill in.
  if (advancement && (c.experience != null || c.advancement === 'milestone')) c.experience = '';
  if (tracking) {
    c.combat.temporaryHP = null;
    c.combat.hitDiceUsed = null;
    c.inspiration = false;
    c.spellSlots = c.spellSlots?.map(s=>({...s,used:null}));
    c.featureUses = c.featureUses?.map(u=>({...u,remaining:null}));
  }
  // Item quantities (rations, arrows, torches…) are the counts that change in play: every quantity box starts empty.
  if (quantities) {
    c.inventoryRows = c.inventoryRows?.map(i=>({...i,quantity:null}));
    c.equipment = uncounted(c.equipment);
  }
  // Tick boxes start empty: proficiency and expertise dots, equipped and attuned items, prepared spells.
  if (proficiencies) {
    c.saves = c.saves?.map(s=>({...s,proficient:false}));
    c.skills = c.skills?.map(s=>({...s,proficient:false,expertise:false}));
  }
  if (equipment) c.inventoryRows = c.inventoryRows?.map(i=>({...i,equipped:false,attuned:false}));
  if (spells) c.spellRows = c.spellRows?.map(s=>({...s,prepared:false}));
  return c;
}

// What the imported character currently has, so players know what to write in.
export function playReminders(character) {
  const c = character, combat = c.combat ?? {};
  const held = COINS.filter(k=>Number(c.coins?.[k])>0).map(k=>`${c.coins[k]} ${k.toUpperCase()}`);
  const tracking = [
    combat.temporaryHP ? `Temp HP ${combat.temporaryHP}` : '',
    combat.hitDiceUsed != null ? `Hit dice spent ${combat.hitDiceUsed}` : '',
    c.inspiration ? 'Inspiration' : '',
    ...(c.spellSlots??[]).filter(s=>s.used!=null).map(s=>`${ordinal(s.level)} slots used ${s.used}/${s.total}`),
    ...(c.featureUses??[]).map(u=>`${u.name} ${u.remaining}/${u.maximum}`),
  ].filter(Boolean);
  const stacks = (c.inventoryRows??[]).filter(i=>i.quantity>1).map(i=>`${i.quantity} × ${i.name}`);
  const count = (rows, test, noun) => { const n = (rows??[]).filter(test).length; return n ? `${n} ${noun}` : ''; };
  return {
    hp: combat.currentHP != null ? `Currently ${combat.currentHP}${combat.maxHP != null ? ' / '+combat.maxHP : ''} HP.` : 'Current HP was not imported.',
    coins: `Currently ${held.join(', ') || 'no coins'}.`,
    advancement: c.advancement === 'milestone' ? 'Currently Milestone.' : c.experience != null && c.experience !== '' ? `Currently XP ${Number(c.experience).toLocaleString('en-GB')}.` : 'No XP was imported.',
    proficiencies: `Currently ${count([...(c.saves??[]),...(c.skills??[])],v=>v.proficient||v.expertise,'proficiencies')||'none ticked'}.`,
    equipment: `Currently ${count(c.inventoryRows,i=>i.equipped,'equipped items')||'nothing equipped'}.`,
    spells: `Currently ${count(c.spellRows,s=>s.level>0&&s.prepared,'prepared spells')||'none prepared'}.`,
    quantities: stacks.length ? `Currently: ${stacks.join(' · ')}.` : 'Every item count is 1.',
    tracking: tracking.length ? `Currently: ${tracking.join(' · ')}.` : 'Nothing to track was imported.',
  };
}
