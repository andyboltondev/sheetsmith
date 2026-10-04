// Optional "fill in at the table" export: leave values that change during play blank,
// so players can pencil them in. Box fields become empty; inline text shows `__`.
export const BLANK = '__';
const COINS = ['pp','gp','ep','sp','cp'];
const ordinal = n => n+(['th','st','nd','rd'][n%100>10&&n%100<14?0:n%10]??'th');
// Stacks (rations, arrows, torches) are the inventory counts that change in play.
const stacked = text => String(text??'').replace(/^(\d+) x /gm,(match,n)=>Number(n)>1?`${BLANK} × `:match);

export function blankForPlay(character, { hp=false, coins=false, tracking=false }={}) {
  const c = structuredClone(character);
  c.blanked = { hp, coins, tracking };
  if (hp) c.combat.currentHP = null;
  if (coins) { c.coins = Object.fromEntries(COINS.map(k=>[k,null])); c.currency = ''; }
  if (tracking) {
    c.combat.temporaryHP = null;
    c.combat.hitDiceUsed = null;
    if (c.experience != null) c.experience = '';
    c.inspiration = false;
    c.spellSlots = c.spellSlots?.map(s=>({...s,used:null}));
    c.featureUses = c.featureUses?.map(u=>({...u,remaining:null}));
    c.inventoryRows = c.inventoryRows?.map(i=>i.quantity>1?{...i,quantity:null}:i);
    c.equipment = stacked(c.equipment);
  }
  return c;
}

// What the imported character currently has, so players know what to write in.
export function playReminders(character) {
  const c = character, combat = c.combat ?? {};
  const held = COINS.filter(k=>Number(c.coins?.[k])>0).map(k=>`${c.coins[k]} ${k.toUpperCase()}`);
  const tracking = [
    c.experience != null && c.advancement !== 'milestone' ? `XP ${Number(c.experience).toLocaleString('en-GB')}` : '',
    combat.temporaryHP ? `Temp HP ${combat.temporaryHP}` : '',
    combat.hitDiceUsed != null ? `Hit dice spent ${combat.hitDiceUsed}` : '',
    c.inspiration ? 'Inspiration' : '',
    ...(c.spellSlots??[]).filter(s=>s.used!=null).map(s=>`${ordinal(s.level)} slots used ${s.used}/${s.total}`),
    ...(c.featureUses??[]).map(u=>`${u.name} ${u.remaining}/${u.maximum}`),
    ...(c.inventoryRows??[]).filter(i=>i.quantity>1).map(i=>`${i.quantity} × ${i.name}`),
  ].filter(Boolean);
  return {
    hp: combat.currentHP != null ? `Currently ${combat.currentHP}${combat.maxHP != null ? ' / '+combat.maxHP : ''} HP.` : 'Current HP was not imported.',
    coins: `Currently ${held.join(', ') || 'no coins'}.`,
    tracking: tracking.length ? `Currently: ${tracking.join(' · ')}.` : 'Nothing to track was imported.',
  };
}
