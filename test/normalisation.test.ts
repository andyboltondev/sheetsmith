import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalise } from '../src/importers/dndbeyond/parser.ts';
const fixture = async () => JSON.parse(await readFile(new URL('../src/sample/martial.json',import.meta.url),'utf8'));
test('feat bonuses, save proficiency, skill expertise, inventory and currency', async () => {
  const source = await fixture();source.data.modifiers.feat=[{type:'bonus',subType:'strength-score',value:2},{type:'expertise',subType:'athletics'}];
  const character = normalise(source);
  assert.equal(character.abilities.strength.score,18);
  assert.equal(character.saves.find(save=>save.name==='strength')?.bonus,7);
  assert.equal(character.skills.find(skill=>skill.name==='Athletics')?.bonus,10);
  assert.equal(character.passivePerception,14);
  assert.match(character.equipment,/10 x Rations/);assert.match(character.currency,/35 GP/);
});
test('spell lists support prepared class spells and race spells', async () => {
  const source = await fixture();source.data.classSpells=[{spells:[{definition:{name:'Shield',level:1},prepared:true}]}];source.data.spells={race:[{definition:{name:'Light',level:0}}]};
  assert.match(normalise(source).spells,/Level 1 - Shield \(prepared\)/);
  assert.match(normalise(source).spells,/Cantrip - Light/);
});
test('conditional modifiers are not applied as unconditional bonuses', async () => {
  const source = await fixture();source.data.modifiers.feat=[{type:'bonus',subType:'strength-score',value:10,restriction:'Only while transformed'}];
  assert.equal(normalise(source).abilities.strength.score,16);
});
