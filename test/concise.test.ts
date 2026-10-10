import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import {gameplayText} from '../src/importers/dndbeyond/concise.ts';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser-compatible JS
import {generatePdf} from '../src/pdf/generator.js';
test('PHB-backed summaries retain play rules and remove explicit upgrades only',()=>{
 const rules='One action. CON save: 2d8 damage; half on success.\nAt Higher Levels. Add 1d8 for each higher slot.';
 assert.equal(gameplayText(rules,'PHB (2014), p. 282',3),'One action. CON save: 2d8 damage; half on success.');
 assert.equal(gameplayText(rules,'',3),rules);
 assert.equal(gameplayText('One use per short rest. At 18th level, use this twice.','PHB (2014), p. 72',3),'One use per short rest.');
 assert.match(gameplayText('Deal 1d10 damage.\nCantrip Upgrade\nAt 5th level, deal 2d10 damage.','PHB (2014), p. 242',5),/2d10/);
});
test('source-defined current subclass features and compact spells remain identifiable',async()=>{
 const raw=JSON.parse(await readFile(new URL('../src/sample/martial.json',import.meta.url),'utf8'));
 raw.data.classes[0].subclassDefinition={name:'Eldritch Knight',classFeatures:[{id:77}]};
 raw.data.classes[0].classFeatures=[{definition:{id:77,name:'Weapon Bond',requiredLevel:3,snippet:'Bonus action: summon your bonded weapon.',sources:[{sourceId:2,pageNumber:75}]}},{definition:{id:78,name:'Future Feature',requiredLevel:18,snippet:'Not yet available.'}}];
 raw.data.classSpells=[{spells:[{definition:{id:1,name:'Magic Missile',level:1,sources:[{sourceId:2,pageNumber:257}],description:'Full details.'}}]}];
 const c=normalise(raw);assert.equal(c.featureRows?.[0].group,'Subclass features');assert.ok(!c.features.includes('Future Feature'));assert.match(c.spells,/1d4 \+ 1/);assert.match(c.spells,/p. 257/);assert.ok(!c.spells.includes('per slot level'));
});
