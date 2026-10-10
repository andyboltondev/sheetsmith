import {loadTemplate,templatePdf,layoutOf} from './helpers/templates.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as P from 'pdf-lib';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
// @ts-expect-error Browser module
import {generatePdf} from '../src/pdf/generator.js';
// @ts-expect-error Browser module
import {blankForPlay, playReminders} from '../src/pdf/fresh.js';
const fixture=async()=>JSON.parse(await readFile(new URL('../src/sample/martial.json',import.meta.url),'utf8'));
const asset=loadTemplate;
const character=async()=>{const raw=await fixture(),d=raw.data;
 d.currentXp=650;d.inspiration=true;d.removedHitPoints=7;d.temporaryHitPoints=3;d.classes[0].hitDiceUsed=2;d.currencies={cp:0,sp:4,ep:0,gp:25,pp:0};
 d.actions={class:[{name:'Action Surge',limitedUse:{maxUses:1,numberUsed:0}}]};
 return normalise(raw);};
const options=async(id:string)=>{const main=await asset(id);return {templateId:id,templateBytes:main.bytes,layout:main.layout};};
const text=async(bytes:Uint8Array)=>{const form=(await P.PDFDocument.load(bytes)).getForm();return Object.fromEntries(form.getFields().filter(f=>f instanceof P.PDFTextField).map(f=>[f.getName(),(f as P.PDFTextField).getText()??'']));};
test('reminders describe what the imported character currently has',async()=>{
 const r=playReminders(await character());
 assert.match(r.hp,/Currently 37 \/ \d+ HP/);assert.equal(r.coins,'Currently 25 GP, 4 SP.');
 assert.match(r.advancement,/XP 650/);assert.match(r.tracking,/Hit dice spent 2/);assert.match(r.tracking,/Action Surge 1\/1/);assert.match(r.quantities,/10 × Rations/);assert.doesNotMatch(r.tracking,/Rations/);
});
test('blanked values print empty boxes and __ in running text',async()=>{
 const c=blankForPlay(await character(),{hp:true,coins:true,tracking:true,advancement:true,quantities:true});
 const official=await text((await generatePdf(P,c,await options('official-alternative'))).bytes);
 assert.equal(official.HPCurrent,'');assert.equal(official.HPTemp,'');assert.equal(official.XP,'');
 assert.equal((await text((await generatePdf(P,c,await options('official-standard'))).bytes)).GP,'');
 const all=Object.values(official).join('\n');
 assert.match(all,/Coins: __ PP, __ GP/);assert.match(all,/__ × Rations/);assert.match(all,/Hit dice used: __/);assert.match(all,/Action\s+Surge: __\/1/);
 assert.doesNotMatch(all,/25 GP|10 × Rations/);
 const compact=await text((await generatePdf(P,c,{templateId:'compact'})).bytes);
 assert.ok(Object.entries(compact).filter(([k])=>/^Item\.\d+\.Qty$/.test(k)).every(([,v])=>v===''),'every quantity box starts empty');
 assert.equal(compact.HPCurrent,'');assert.equal(compact['Coins.GP'],'');assert.equal(compact.Experience,'');
});
test('unticked options leave the sheet unchanged',async()=>{
 const c=await character();assert.deepEqual(blankForPlay(c,{}).coins,c.coins);assert.equal(blankForPlay(c,{coins:true}).combat.currentHP,37);
});

test('each tick-box group can be left blank on its own',async()=>{
 const c=await character();c.spellRows=[{name:'Shield',level:1,prepared:true}] as any;const marks=(x:any)=>[[...x.saves,...x.skills].some((v:any)=>v.proficient||v.expertise),(x.inventoryRows??[]).some((i:any)=>i.equipped||i.attuned),(x.spellRows??[]).some((s:any)=>s.prepared)];
 assert.deepEqual(marks(c),[true,true,true],'the sample has something ticked in every group');
 assert.deepEqual(marks(blankForPlay(c,{proficiencies:true})),[false,true,true]);
 assert.deepEqual(marks(blankForPlay(c,{equipment:true})),[true,false,true]);
 assert.deepEqual(marks(blankForPlay(c,{spells:true})),[true,true,false]);
 assert.deepEqual(blankForPlay(c,{}).saves,c.saves,'nothing is cleared unless asked');
});
test('advancement can be left blank for XP and for milestone sheets',async()=>{
 const c=await character();
 assert.equal(blankForPlay(c,{advancement:true}).experience,'');
 const milestone={...c,advancement:'milestone',experience:null};
 assert.equal((await text((await generatePdf(P,blankForPlay(milestone,{advancement:true}),{templateId:'compact'})).bytes)).Experience,'');
 assert.equal((await text((await generatePdf(P,milestone,{templateId:'compact'})).bytes)).Experience,'Milestone');
});
test('page numbers are on by default and can be removed from the SheetSmith sheet',async()=>{
 const c=await character(),size=async(options:object)=>(await generatePdf(P,c,{templateId:'compact',...options})).bytes.length;
 const plain=await P.PDFDocument.load((await generatePdf(P,c,{templateId:'compact',pageNumbers:false})).bytes),numbered=await P.PDFDocument.load((await generatePdf(P,c,{templateId:'compact'})).bytes);
 assert.equal(plain.getPageCount(),numbered.getPageCount());
 assert.ok(await size({})>await size({pageNumbers:false}),'the footer is added unless turned off');
 assert.equal(await size({}),await size({pageNumbers:true}));
});
test('item quantities can be left blank on their own, as stacks or all counts',async()=>{
 const c=await character(),blank=blankForPlay(c,{quantities:true});
 assert.ok(blank.inventoryRows!.every((i:any)=>i.quantity===null));assert.ok(!/\d+ x /.test(blank.equipment));
 assert.deepEqual(blankForPlay(c,{tracking:true}).inventoryRows,c.inventoryRows,'tracking no longer touches item counts');
 assert.deepEqual(blankForPlay(c,{}).inventoryRows,c.inventoryRows);
});
