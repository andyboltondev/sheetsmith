import {templatePdf,layoutOf} from './helpers/templates.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
// @ts-expect-error Browser-compatible JS module.
import {generatePdf} from '../src/pdf/generator.js';
import {normalise} from '../src/importers/dndbeyond/parser.ts';
for(const id of ['official-standard','official-alternative'])for(const order of ['score-first','modifier-first'])test(`${id}: ${order} maps all abilities and preserves editable fields`,async()=>{
 const raw=JSON.parse(await readFile(new URL('../src/sample/martial.json',import.meta.url),'utf8'));const c=normalise(raw);
 const result=await generatePdf(PDFLib,c,{templateId:id,abilityOrder:order,templateBytes:await templatePdf(id),layout:await layoutOf(id),playerName:'Andy'});
 const doc=await PDFLib.PDFDocument.load(result.bytes),form=doc.getForm();
 assert.equal(doc.catalog.get(PDFLib.PDFName.of('Lang'))?.toString(),'(en-GB)');
 assert.ok(form.getTextField('strength.score').acroField.dict.has(PDFLib.PDFName.of('TU')));
 for(const [key,v] of Object.entries(c.abilities)){
  const score=form.getTextField(`${key}.score`),mod=form.getTextField(`${key}.modifier`);
  assert.equal(score.getText(),String(v.score));assert.equal(mod.getText(),`${v.modifier>=0?'+':''}${v.modifier}`);
  assert.equal(score.acroField.getWidgets()[0].getRectangle().y>mod.acroField.getWidgets()[0].getRectangle().y,order==='score-first');
 }
 assert.equal(form.getTextField('AC').getText(),'18');
 if(id==='official-alternative'){
  assert.equal(form.getTextField('Insight').getText(),'+1');assert.equal(form.getTextField('History').getText(),'+0');
 }
 assert.ok(doc.getPageCount()>=2);
});
