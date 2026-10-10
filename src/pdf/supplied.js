import { appendOfficialSpells } from './spells.js';
import { appendContinuations } from './continuation.js';
import { coinLine, createCleaner, displayItems, dotAppearance, embedPortrait, fieldFactory, fitText, loadPdf, savePdf, signed } from './generator.js';
const abilityNames = ['strength','dexterity','constitution','intelligence','wisdom','charisma'];
// Reader-facing names for template fields, used to title continued text.
const fieldLabels = {PersonalityTraits:'Personality traits',AttacksSpellcasting:'Attacks & spellcasting','Features and Traits':'Features & traits',ProficienciesLang:'Other proficiencies & languages',Backstory:'Character backstory',Allies:'Allies & organizations','Feat+Traits':'Additional features & traits'};
const fieldLabel = name => { const base=name.trim().replace(/-Alt/g,''); return fieldLabels[base]??base.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/ (\d+)$/,' (level $1)'); };
// Every continued box points to the matching panel, whether on page 2 or on an added page.
const CONTINUED_MARKER = '(Continued in Additional Features & Traits)';
const headingFor = group => `${group.label.toUpperCase()}${group.continued?' (CONTINUED)':''}`;
const itemTags = i => [i.rarity,i.attunement?(i.attuned?'attuned':'requires attunement'):''].filter(Boolean).join(', ');
export async function generateSuppliedPdf(PDFLib, character, options) {
  const {StandardFonts,TextAlignment}=PDFLib;
  const doc=await loadPdf(PDFLib,options.templateBytes);
  doc.setLanguage('en-GB');
  const form=doc.getForm(),fields=fieldFactory(PDFLib,form),font=await doc.embedFont(StandardFonts.Helvetica);
  const pages=doc.getPages(),warnings=[],overflow=[];
  const layout=structuredClone(options.layout);
  const alt=options.templateId==='official-alternative';
  const clean=createCleaner(font,warnings);
  const values={};
  const put=(k,v)=>{values[k]=v;};
  const identity=character.identity,d=character.details??{},tracking=!!character.blanked?.tracking;
  // Blanked values print as `__` inside running text, so players can write them in.
  const slotText=s=>`level ${s.level}: ${s.total} total${s.used!=null?', '+s.used+' used':tracking?', __ used':''}`,useText=u=>`${u.name}: ${u.remaining??'__'}/${u.maximum}`;
  // Official sheets have no subclass box, so it joins the class and level (D&D Beyond lists it as a feature).
  const classLevel=character.classes.map(c=>`${c.name} ${c.level}${c.subclass?` (${c.subclass})`:''}`).join(' / ');
  // Items with their weight, as on D&D Beyond's equipment page, then the encumbrance totals.
  // Weights can be left off entirely: no item weights and no carried / capacity line.
  const weights=options.equipmentWeight!==false;
  const lb=n=>weights&&n?`${Math.round(n*100)/100} lb`:'';
  const itemLine=(i,tagEquipped)=>{const tags=[tagEquipped&&i.equipped?'equipped':'',i.attuned?'attuned':'',lb(i.weight)].filter(Boolean);return `${i.quantity==null?'__ × ':i.quantity>1?i.quantity+' × ':''}${i.name}${tags.length?` (${tags.join(', ')})`:''}`;};
  const carry=weights?character.carrying:null,carryLine=carry?`Carried ${lb(carry.weight)||'0 lb'} · capacity ${lb(carry.capacity)} · push, drag or lift ${lb(carry.pushDragLift)}`:'';
  put('ClassLevel',classLevel);put('CharacterName',identity.name);
  put('Race ',identity.species);put('Background',identity.background);put('Alignment',identity.alignment??'');
  put('PlayerName',options.playerName||identity.playerName);
  put('ProfBonus',signed(character.proficiencyBonus));put('AC',character.combat.armourClass);
  put('Initiative',signed(character.combat.initiative));put('Speed',character.combat.speed);
  put('HPMax',character.combat.maxHP);put('Passive',character.passivePerception);
  put('XP',character.advancement==='milestone'&&character.experience!==''?'Milestone':character.experience);put('HPCurrent',character.combat.currentHP);put('HPTemp',character.combat.temporaryHP);
  put('Inspiration',character.inspiration?'Yes':'');
  put('HDTotal',character.classes.reduce((s,c)=>s+c.level,0));put('HD',character.combat.hitDice);
  const putTrim=(key,v)=>{const f=layout.find(f=>f.name.trim()===key);if(f)put(f.name,v);};
  const weapons=character.weapons??[];
  // Older imports have no attack rows; fall back to weapons only.
  const attacks=character.attacks??weapons.map(w=>({...w,source:'weapon'}));
  const hit=a=>a.attackBonus!=null?signed(a.attackBonus):a.save??'Check';
  const baseNote=n=>n.replace(/;? ?Base roll; conditional bonuses not included\./,'').trim();
  const weaponSlots=layout.filter(f=>/^Wpn Name/.test(f.name)).sort((a,b)=>b.rect[1]-a.rect[1]);
  weaponSlots.forEach((f,i)=>{const w=attacks[i];if(!w)return;put(f.name,w.name);putTrim(`Wpn${i+1} AtkBonus`,hit(w));putTrim(`Wpn${i+1} Damage`,w.damage);});
  // Rows that did not fit the table, then notes for the rows that did.
  const attackLines=[...attacks.slice(weaponSlots.length).map(a=>`${a.name}: ${hit(a)}, ${a.damage}${a.notes?' ('+baseNote(a.notes)+')':''}`),...attacks.slice(0,weaponSlots.length).filter(a=>a.source==='weapon'&&baseNote(a.notes)).map(a=>`${a.name}: ${baseNote(a.notes)}`)];
  const spells=character.spellRows??[];
  const magic=(character.inventoryRows??[]).filter(i=>i.magic).sort((a,b)=>Number(!!b.attuned)-Number(!!a.attuned)||Number(b.equipped)-Number(a.equipped));
  put('AttacksSpellcasting',[...attackLines,spells.length?(options.spellResource?'Spells: see the spellcasting page.':'Spells: '+spells.map(s=>`${s.name} (${s.level===0?'C':s.level})`).join(', ')):''].filter(Boolean).join('\n'));
  // Sort by actual vertical location: the alternative sheet reverses the physical boxes.
  abilityNames.forEach((key,i)=>{
    const short=key.slice(0,3),cap=short[0].toUpperCase()+short.slice(1);
    const names=[short.toUpperCase(),['STRmod','DEXmod ','CONmod','INTmod','WISmod','CHamod'][i]];
    const pair=names.map(n=>layout.find(f=>f.name===n));
    if(pair.some(f=>!f))throw new Error(`Template is missing ${key} boxes.`);
    pair.sort((a,b)=>b.rect[1]-a.rect[1]);
    const a=character.abilities[key],modifierFirst=options.abilityOrder==='modifier-first';
    put(pair[0].name,modifierFirst?signed(a.modifier):a.score);put(pair[1].name,modifierFirst?a.score:signed(a.modifier));
    pair.forEach((f,index)=>{f.center=true;f.ability=true;f.semanticName=`${key}.${index===0?(modifierFirst?'modifier':'score'):(modifierFirst?'score':'modifier')}`;});
    const save=character.saves.find(s=>s.name===key);
    if(save){put(alt?`SavingThrows${i?i+1:''}`:`ST ${key[0].toUpperCase()+key.slice(1)}`,signed(save.bonus));
      put(alt?`ST ${key[0].toUpperCase()+key.slice(1)}`:`Check Box ${i===0?11:17+i}`,save.proficient);}
  });
  const standardChecks={Acrobatics:23,'Animal Handling':24,Arcana:25,Athletics:26,Deception:27,History:28,Insight:29,Intimidation:30,Investigation:31,Medicine:32,Nature:33,Perception:34,Performance:35,Persuasion:36,Religion:37,'Sleight of Hand':38,Stealth:39,Survival:40};
  for(const skill of character.skills){
    let key=skill.name==='Sleight of Hand'?'SleightofHand':skill.name==='Animal Handling'&&!alt?'Animal':skill.name;
    const existing=layout.find(f=>f.name.trim()===key);
    put(existing?.name??key,signed(skill.bonus));
    put(alt?`ChBx ${{'Animal Handling':'Animal','Sleight of Hand':'Sleight'}[skill.name]??skill.name}`:`Check Box ${standardChecks[skill.name]}`,skill.proficient);
  }
  put('CharacterName 2',identity.name);
  for(const key of ['age','height','weight','eyes','skin','hair'])put(key[0].toUpperCase()+key.slice(1),d[key]);
  for(const [key,name] of [['personalityTraits','PersonalityTraits '],['ideals','Ideals'],['bonds','Bonds'],['flaws','Flaws']])put(name,d[key]);
  put('Backstory',d.backstory);put('Allies',[d.allies,d.organizations?'Organizations: '+d.organizations:'',d.enemies?'Enemies: '+d.enemies:''].filter(Boolean).join('\n\n'));
  put('Equipment',[character.inventoryRows?.length?character.inventoryRows.map(i=>itemLine(i,true)).join('\n'):displayItems(character.equipment),carryLine,alt?coinLine(character.coins):''].filter(Boolean).join('\n\n'));
  put('Features and Traits',[character.features,character.combat.hitDiceUsed!=null||tracking?'Hit dice used: '+(character.combat.hitDiceUsed??'__'):'',character.featureUses?.length?'Feature uses remaining: '+character.featureUses.map(useText).join('; '):'',character.spellSlots?.length?'Spell slots: '+character.spellSlots.map(slotText).join('; '):''].filter(Boolean).join('\n\n'));
  const holdingsKey=layout.some(f=>f.name==='Treasure')?'Treasure':'Equipment';
  for(const [label,content] of [['Personal possessions',d.personalPossessions],['Other holdings',d.otherHoldings]]){if(content){const key=holdingsKey;put(key,[values[key],label+':\n'+content].filter(Boolean).join('\n\n'));}}
  // The printed details boxes stop at hair; gender, size, faith and lifestyle lead the appearance text instead.
  const identityLine=[['Gender','gender'],['Size','size'],['Faith','faith'],['Lifestyle','lifestyle']].filter(([,k])=>d[k]).map(([n,k])=>`${n}: ${d[k]}`).join(' · ');
  const appearance=[identityLine,d.appearance].filter(Boolean).join('\n\n');
  if(appearance){const portrait=layout.find(f=>/^CHARACTER IMAGE$/.test(f.name));if(portrait&&!options.portrait){layout.push({...portrait,name:'Character appearance',type:'/Tx',pushbutton:false,multiline:true,value:''});put('Character appearance',appearance);}else overflow.push({label:'Appearance',text:clean(appearance)});}
  if(d.otherNotes)overflow.push({label:'Other notes',text:clean(d.otherNotes)});
  if(magic.length)overflow.push({label:'Magic items',text:clean(magic.map(i=>`${i.name}${itemTags(i)?' ('+itemTags(i)+')':''}: ${i.summary}`).join('\n'))});
  for(const coin of ['cp','sp','ep','gp','pp'])put(coin.toUpperCase(),character.coins?.[coin]===null?'':character.coins?.[coin]??0);

  const def=character.defences??{},sensesBlock=[
    [character.passiveInsight!=null?`Passive Insight ${character.passiveInsight}`:'',character.passiveInvestigation!=null?`Passive Investigation ${character.passiveInvestigation}`:''].filter(Boolean).join(' · '),
    character.senses?.length?'Senses: '+character.senses.join(', '):'',character.speeds?.length?'Speeds: '+character.speeds.join(', '):'',
    def.resistances?.length?'Resistances: '+def.resistances.join(', '):'',def.immunities?.length?'Immunities: '+def.immunities.join(', '):'',def.vulnerabilities?.length?'Vulnerabilities: '+def.vulnerabilities.join(', '):'',
    ...(def.saveNotes??[])].filter(Boolean).join('\n');
  // Training grouped as D&D Beyond prints it: armour, weapons, tools, then languages.
  const pg=character.proficiencyGroups,training=pg?[['Armour',pg.armour],['Weapons',pg.weapons],['Tools',pg.tools]].filter(([,v])=>v?.length).map(([n,v])=>`${n}: ${v.join(', ')}`).join('\n'):character.proficiencies;
  put('ProficienciesLang',[sensesBlock,training,character.languages&&'Languages: '+character.languages].filter(Boolean).join('\n\n'));
  // Spells remain complete and readable on editable continuation pages.
  // The official spellcasting page lists names only, so details follow it.
  const spellDetails=spells.map(s=>`${s.name} (${s.level===0?'cantrip':'level '+s.level}${s.ritual?', ritual':''}): ${[s.casting,s.range,s.duration+(s.concentration?' (C)':''),s.components,s.requiresSave?`${s.savingThrow} save DC ${s.saveDC??'?'}`:s.requiresAttack&&s.attackBonus!=null?signed(s.attackBonus)+' to hit':''].filter(Boolean).join(' · ')}. ${s.summary}${s.restriction?' '+s.restriction:''}${s.reference?' ['+s.reference+']':''}`).join('\n');
  if(character.spells)overflow.push(options.spellResource&&spells.length?{label:'Spell details',text:clean(spellDetails)}:{label:'Spells',text:clean(character.spells)});
  // Multiline boxes: shrink to fit, and give related boxes one shared size so they read as a set.
  const isMultiline=f=>f.type==='/Tx'&&!f.ability&&!/^(HPCurrent|HPTemp)$/.test(f.name)&&(f.multiline||f.rect[3]-f.rect[1]>45);
  const boxFor=f=>{
    const [x,y,right,top]=f.rect;
    // Official personality boxes print their caption inside the field's bottom edge.
    const caption=/^(PersonalityTraits|Ideals|Bonds|Flaws)$/.test(f.name.trim())?5:0;
    // Favourite-spell effects are one-line reminders; the spell cards hold the full text.
    const reminder=/Spell Effect \d/.test(f.name)&&f.page===0;
    return {width:Math.max(20,right-x-4),height:top-y-3-caption,max:10,min:reminder?5:caption?6:7,reminder};
  };
  const groupOf=f=>{
    const base=f.name.trim().replace(/-Alt/g,'');
    if(/^(PersonalityTraits|Personality Traits|Ideals|Bonds|Flaws)$/.test(base))return 'personality';
    return null;
  };
  const groupSize={};
  for(const f of layout){const group=groupOf(f);if(!group||!isMultiline(f))continue;
    const size=fitText(clean(Object.hasOwn(values,f.name)?values[f.name]:f.value),font,boxFor(f)).size;
    groupSize[group]=Math.min(groupSize[group]??Infinity,size);}
  for(const f of layout){
    if(f.pushbutton)continue;
    const [x,y,right,top]=f.rect,width=right-x,height=top-y;
    const name=f.semanticName??f.name;
    const description=name.replace(/-Alt/g,'').replace(/[_.]/g,' ').replace(/\bAC\b/g,'Armour Class').replace(/\bHP\b/g,'Hit Points');
    if(fields.has(name))continue;
    if(f.type==='/Btn'){
      const check=fields.checkBox(name,description);check.addToPage(pages[f.page],{x,y,width,height,borderWidth:0,backgroundColor:undefined,borderColor:undefined});if(values[f.name]===true)check.check();check.updateAppearances(()=>dotAppearance(PDFLib,width,height));continue;
    }
    if(f.type!=='/Tx')continue;
    let value=clean(Object.hasOwn(values,f.name)?values[f.name]:f.value);
    const field=fields.text(name,description);
    const multiline=isMultiline(f);
    let size=f.ability?Math.min(22,height*.67):Math.min(11,height*.65);
    if(multiline){
      field.enableMultiline();
      const box=boxFor(f),shared=groupSize[groupOf(f)];
      const fitOptions={...box,max:shared??box.max,marker:box.reminder?'… (see spell cards)':CONTINUED_MARKER};
      let fit=fitText(value,font,fitOptions);
      // Short list entries (equipment, proficiencies) can run inline in wide boxes instead of overflowing.
      const entries=value.split('\n').filter(Boolean);
      if(fit.rest&&entries.length>4&&entries.every(line=>line.length<40)){
        const inline=fitText(value.split(/\n{2,}/).map(block=>block.split('\n').join(' · ')).join('\n'),font,fitOptions);
        if(!inline.rest)fit=inline;
      }
      size=fit.size;value=fit.text;
      if(fit.rest&&!box.reminder)overflow.push({label:fieldLabel(f.name),text:fit.rest,continued:true});
    }else{
      size=Math.max(5,Math.min(size,(width-4)/Math.max(1,font.widthOfTextAtSize(value||' ',1))));
    }
    field.setText(value);field.addToPage(pages[f.page],{x,y,width,height,font,borderWidth:0,backgroundColor:undefined,borderColor:undefined});field.setFontSize(size);
    const numericStat=!multiline&&(/^[+-]?\d+(?:\s*(?:ft|d\d+))?$/.test(value)||/^(AC|HPMax|HPCurrent|HPTemp|Initiative|Speed|ProfBonus|Passive|HDTotal|HD)$/.test(f.name));
    field.setAlignment(f.center||numericStat||f.align===1?TextAlignment.Center:TextAlignment.Left);
  }
  if(options.portrait){
    const f=layout.find(f=>/CHARACTER IMAGE/.test(f.name));
    if(f){const [x,y,r,t]=f.rect,img=await embedPortrait(doc,options.portrait),scale=Math.min((r-x)/img.width,(t-y)/img.height);pages[f.page].drawImage(img,{x:x+(r-x-img.width*scale)/2,y:y+(t-y-img.height*scale)/2,width:img.width*scale,height:img.height*scale});}
  }
  if(options.spellResource&&character.spellRows?.length)await appendOfficialSpells(PDFLib,doc,fields,font,character,options.spellResource,clean);
  // Official sheets: fill the empty "Additional features & traits" panel before adding pages.
  if(overflow.length){
    const target=form.getTextField('Feat+Traits'),f=layout.find(f=>f.name==='Feat+Traits');
    // Long spell lists read best last, after shorter continued notes.
    overflow.sort((a,b)=>/^Spell/.test(a.label)-/^Spell/.test(b.label));
    if(f&&!target.getText()){
      const [x,y,right,top]=f.rect;
      const headings=new Set(overflow.map(headingFor));
      const fit=fitText(overflow.map(g=>`${headingFor(g)}\n${g.text}`).join('\n\n'),font,{width:right-x-4,height:top-y-3,max:9,min:7,marker:'(Continued on the next page)',isHeading:line=>headings.has(line)});
      target.enableMultiline();target.setText(fit.text);target.setFontSize(fit.size);
      overflow.splice(0,overflow.length,...(fit.rest?[{label:'Additional features & traits',text:fit.rest,continued:true}]:[]));
    }
  }
  await appendContinuations(PDFLib,doc,fields,font,overflow.map(g=>({...g,label:headingFor(g)})),options,clean);
  doc.setTitle(`${clean(identity.name)} — 5e Character Sheet`);
  doc.setSubject(`5e; ${options.abilityOrder==='modifier-first'?'Modifier above score':'Score above modifier'}`);
  return {bytes:await savePdf(PDFLib,doc,form,font),warnings};
}
