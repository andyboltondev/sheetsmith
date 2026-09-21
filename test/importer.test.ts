import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterId } from '../src/importers/dndbeyond/url.ts';
import { normalise } from '../src/importers/dndbeyond/parser.ts';
import { createDndBeyondImporter } from '../src/importers/dndbeyond/index.ts';
import { abilityModifier, proficiencyBonus } from '../src/character/calculations.ts';
const fixture = () => ({ data: { name: 'Example Fighter', classes: [{ definition: { name: 'Fighter' }, level: 5 }], stats: [16, 14, 15, 8, 12, 10].map((value, i) => ({ id: i + 1, value })) } });

test('accepts both supported URL formats', () => {
  assert.equal(characterId('https://www.dndbeyond.com/characters/171344792'), '171344792');
  assert.equal(characterId('https://character-service.dndbeyond.com/character/v5/character/171344792'), '171344792');
});
test('rejects unrelated hosts, credentials, protocols and malformed paths', () => {
  for (const url of ['https://evil.test/characters/123', 'https://www.dndbeyond.com.evil.test/characters/123', 'http://www.dndbeyond.com/characters/123', 'https://user@www.dndbeyond.com/characters/123', 'https://www.dndbeyond.com/characters/123/other', '123']) assert.throws(() => characterId(url));
});
test('calculates modifiers and proficiency boundaries', () => {
  assert.equal(abilityModifier(9), -1);
  assert.deepEqual([1, 4, 5, 9, 13, 17, 20].map(proficiencyBonus), [2, 2, 3, 4, 5, 6, 6]);
  assert.throws(() => proficiencyBonus(0));
});
test('normalises minimal data without mutating source', () => {
  const source = fixture(); const original = structuredClone(source);
  const result = normalise(source);
  assert.equal(result.abilities.strength.modifier, 3);
  assert.equal(result.proficiencyBonus, 3);
  assert.equal(result.identity.background, '');
  assert.ok(result.warnings.length);
  assert.deepEqual(source, original);
});
test('supports multiclass levels and explicit ability overrides', () => {
  const source = fixture();
  source.data.classes.push({ definition: { name: 'Wizard' }, level: 4 });
  const result = normalise({ data: { ...source.data, bonusStats: [{ id: 1, value: 2 }], overrideStats: [{ id: 1, value: 20 }] } });
  assert.equal(result.proficiencyBonus, 4);
  assert.equal(result.abilities.strength.score, 20);
});
test('rejects missing required data', () => {
  assert.throws(() => normalise({ data: { name: 'Incomplete' } }));
});
test('imports via fixed upstream URL with injected transport', async () => {
  const importer = createDndBeyondImporter(async (url) => {
    assert.equal(url, 'https://character-service.dndbeyond.com/character/v5/character/123');
    return Response.json(fixture());
  });
  assert.equal((await importer.import('https://www.dndbeyond.com/characters/123')).identity.name, 'Example Fighter');
});
test('reports unavailable characters and invalid responses', async () => {
  for (const [response, message] of [[new Response(null, { status: 404 }), /could not be retrieved/], [new Response('bad'), /unsupported/]] as const) {
    await assert.rejects(createDndBeyondImporter(async () => response).import('https://www.dndbeyond.com/characters/123'), message);
  }
});
