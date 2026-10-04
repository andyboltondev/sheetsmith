import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as P from 'pdf-lib';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser module
import {generatePdf} from '../src/pdf/generator.js';
// @ts-expect-error Browser module
import {blankForPlay, playReminders} from '../src/pdf/fresh.js';
const fixture=async()=>JSON.parse(await readFile(new URL('./fixtures/martial.json',import.meta.url),'utf8'));
const asset=async(id:string)=>({bytes:await readFile(new URL(`../templates/${id}.pdf`,import.meta.url)),layout:JSON.parse(await readFile(new URL(`../templates/${id}.json`,import.meta.url),'utf8'))});
const character=async()=>{const raw=await fixture(),d=raw.data;
 d.currentXp=650;d.inspiration=true;d.removedHitPoints=7;d.temporaryHitPoints=3;d.classes[0].hitDiceUsed=2;d.currencies={cp:0,sp:4,ep:0,gp:25,pp:0};
 d.actions={class:[{name:'Action Surge',limitedUse:{maxUses:1,numberUsed:0}}]};
 return normalise(raw);};
const options=async(id:string)=>{const main=await asset(id);return {templateId:id,templateBytes:main.bytes,layout:main.layout};};
const text=async(bytes:Uint8Array)=>{const form=(await P.PDFDocument.load(bytes)).getForm();return Object.fromEntries(form.getFields().filter(f=>f instanceof P.PDFTextField).map(f=>[f.getName(),(f as P.PDFTextField).getText()??'']));};
test('reminders describe what the imported character currently has',async()=>{
 const r=playReminders(await character());
 assert.match(r.hp,/Currently 37 \/ \d+ HP/);assert.equal(r.coins,'Currently 25 GP, 4 SP.');
 assert.match(r.tracking,/XP 650/);assert.match(r.tracking,/Hit dice spent 2/);assert.match(r.tracking,/Action Surge 1\/1/);assert.match(r.tracking,/10 × Rations/);
});
test('blanked values print empty boxes and __ in running text',async()=>{
 const c=blankForPlay(await character(),{hp:true,coins:true,tracking:true});
 const official=await text((await generatePdf(P,c,await options('official-alternative'))).bytes);
 assert.equal(official.HPCurrent,'');assert.equal(official.HPTemp,'');assert.equal(official.XP,'');
 assert.equal((await text((await generatePdf(P,c,await options('official-standard'))).bytes)).GP,'');
 const all=Object.values(official).join('\n');
 assert.match(all,/Coins: __ PP, __ GP/);assert.match(all,/__ × Rations/);assert.match(all,/Hit dice used: __/);assert.match(all,/Action\s+Surge: __\/1/);
 assert.doesNotMatch(all,/25 GP|10 × Rations/);
 const compact=await text((await generatePdf(P,c,{templateId:'compact'})).bytes);
 assert.equal(compact.HPCurrent,'');assert.equal(compact['Coins.GP'],'');assert.equal(compact.Experience,'');
});
test('unticked options leave the sheet unchanged',async()=>{
 const c=await character();assert.deepEqual(blankForPlay(c,{}).coins,c.coins);assert.equal(blankForPlay(c,{coins:true}).combat.currentHP,37);
});
