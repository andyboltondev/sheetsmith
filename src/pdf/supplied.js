import { appendClassSpells } from './spells.js';
import { appendContinuations } from './continuation.js';
import { coinLine, displayItems, fitText } from './generator.js';
const signed = n => n >= 0 ? `+${n}` : String(n);
const abilityNames = ['strength','dexterity','constitution','intelligence','wisdom','charisma'];
// Reader-facing names for template fields, used to title continued text.
const fieldLabels = {PersonalityTraits:'Personality traits',AttacksSpellcasting:'Attacks & spellcasting','Features and Traits':'Features & traits',ProficienciesLang:'Other proficiencies & languages',Backstory:'Character backstory',Allies:'Allies & organizations','Feat+Traits':'Additional features & traits','Additional Features & Traits':'Additional features & traits',Background:'Background',Backpack:'Backpack & storage'};
const fieldLabel = name => { const base=name.trim().replace(/^(Front_|Back_)/,'').replace(/-Arc\d+|-Alt/g,''); return fieldLabels[base]??base.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/ (\d+)$/,' (level $1)'); };
// Every continued box points to the matching panel, whether on page 2 or on an added page.
const CONTINUED_MARKER = '(Continued in Additional Features & Traits)';
const headingFor = group => `${group.label.toUpperCase()}${group.continued?' (CONTINUED)':''}`;
export async function generateSuppliedPdf(PDFLib, character, options) {
  const {PDFDocument,StandardFonts,rgb,TextAlignment}=PDFLib;
  const doc=await PDFDocument.load(options.templateBytes);
  doc.setLanguage('en-GB');
  const form=doc.getForm(),font=await doc.embedFont(StandardFonts.Helvetica);
  const pages=doc.getPages(),warnings=[],overflow=[];
  const layout=structuredClone(options.layout);
  const isClass=options.templateId.startsWith('class-'),alt=options.templateId==='official-alternative';
  const clean=v=>[...String(v??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&ldquo;|&rdquo;/g,'"').replace(/&rsquo;|&#39;/g,"'").replace(/&mdash;/g,' - ')].map(c=>{if(c==='\n')return c;try{font.encodeText(c);return c;}catch{if(!warnings.length)warnings.push('Some unsupported characters were replaced with ?.');return '?';}}).join('');
  const values={};
  const put=(k,v)=>{values[k]=v;};
  const identity=character.identity,d=character.details??{};
  const classLevel=character.classes.map(c=>`${c.name} ${c.level}`).join(' / ');
  const front=layout.find(f=>f.name.startsWith('Front_Character Name'))?.name.replace('Front_Character Name','')??'';
  const fp=k=>`Front_${k}${front}`;
  const set=(official,cls,v)=>put(isClass?fp(cls):official,v);
  set('CharacterName','Character Name',identity.name);set('ClassLevel','Level',isClass?character.classes.reduce((s,c)=>s+c.level,0):classLevel);
  set('Race ','Race',identity.species);set('Background','Background',identity.background);set('Alignment','Alignment',identity.alignment??'');
  put('PlayerName',options.playerName??identity.playerName);put(fp('Archetype'),character.classes.map(c=>c.subclass).filter(Boolean).join(' / '));
  set('ProfBonus','Proficiency',signed(character.proficiencyBonus));set('AC','AC',character.combat.armourClass);
  set('Initiative','Initiative',signed(character.combat.initiative));set('Speed','Speed',character.combat.speed);
  set('HPMax','Max HP',character.combat.maxHP);set('Passive','Passive Perception',character.passivePerception);
  set('XP','XP',character.experience);set('HPCurrent','Current HP',character.combat.currentHP);set('HPTemp','Temp HP',character.combat.temporaryHP);put(fp('Used Hit Dice'),character.combat.hitDiceUsed);
  if(isClass){const inspiration=layout.find(f=>f.name===fp('Inspiration'));put(fp('Inspiration'),inspiration?.type==='/Btn'?character.inspiration:character.inspiration?'Yes':'');const insight=character.skills.find(s=>s.name==='Insight');if(insight)put(fp('Passive Insight'),10+insight.bonus);for(const use of character.featureUses??[]){const field=layout.find(f=>f.name===fp(use.name)&&f.rect[2]-f.rect[0]<90);if(field)put(field.name,use.remaining);}}else put('Inspiration',character.inspiration?'Yes':'');
  set('HDTotal','Total Hit Dice',character.classes.reduce((s,c)=>s+c.level,0));put('HD',character.combat.hitDice);
  const putTrim=(key,v)=>{const f=layout.find(f=>f.name.trim()===key);if(f)put(f.name,v);};
  const weapons=character.weapons??[];
  const weaponSlots=isClass?layout.filter(f=>/^Front_Weapon Name \d/.test(f.name)).sort((a,b)=>Number(a.name.match(/Name (\d+)/)[1])-Number(b.name.match(/Name (\d+)/)[1])):layout.filter(f=>/^Wpn Name/.test(f.name)).sort((a,b)=>b.rect[1]-a.rect[1]);
  weaponSlots.forEach((f,i)=>{const w=weapons[i];if(!w)return;put(f.name,w.name);if(isClass){put(f.name.replace('Weapon Name','Weapon Atk Bonus'),w.attackBonus==null?'Check':signed(w.attackBonus));put(f.name.replace('Weapon Name','Weapon Damage'),w.damage);}else{putTrim(`Wpn${i+1} AtkBonus`,w.attackBonus==null?'Check':signed(w.attackBonus));putTrim(`Wpn${i+1} Damage`,w.damage);}});
  const weaponNotes=weapons.map(w=>`${w.name}${w.equipped?' (equipped)':''}: ${w.attackBonus==null?'check attack':'base attack '+signed(w.attackBonus)}; ${w.damage}. ${w.notes}`).join('\n');
  if(weaponNotes){if(!isClass) put('AttacksSpellcasting',weaponNotes);}
  const spells=character.spellRows??[];
  if(isClass){
    for(const field of layout){const match=field.name.match(/Spell Slot (\d)(?:st|nd|rd|th) (\d)/);if(match){const slot=character.spellSlots?.find(s=>s.level===Number(match[1]));if(slot?.used!=null)put(field.name,Number(match[2])<=Math.min(slot.used,slot.total));}}
    const names=layout.filter(f=>/^Front_Spell Name \d/.test(f.name)).sort((a,b)=>Number(a.name.match(/Name (\d+)/)[1])-Number(b.name.match(/Name (\d+)/)[1]));
    names.forEach((f,i)=>{const spell=spells[i];if(!spell)return;put(f.name,spell.name);put(f.name.replace('Spell Name','Spell Level'),spell.level===0?'C':spell.level);put(f.name.replace('Spell Name','Spell Ritual'),spell.ritual);});
    const favourites=layout.filter(f=>/^Front_Spell Attack Name \d/.test(f.name)).sort((a,b)=>b.rect[1]-a.rect[1]);
    favourites.forEach((f,i)=>{const spell=spells[i];if(!spell)return;put(f.name,spell.name);for(const [key,value] of [['Range',spell.range],['Casting Time',spell.casting],['Save',spell.requiresSave?`${spell.savingThrow} ${spell.saveDC??'?'}`:spell.requiresAttack&&spell.attackBonus!=null?signed(spell.attackBonus)+' atk':'—'],['Concentration',spell.concentration],['Effect',`${spell.summary.split('. ')[0].replace(/\.$/,'')}. ${spell.reference}`]]){const name=f.name.replace('Spell Attack Name','Spell '+key);put(name,value);if(key==='Effect'){const field=layout.find(v=>v.name===name);if(field)field.multiline=true;}}});
    const attacks=[...new Set(spells.map(s=>s.attackBonus).filter(v=>v!=null))],dc=[...new Set(spells.map(s=>s.saveDC).filter(v=>v!=null))];
    if(attacks.length===1)put(fp('Spell Atk'),signed(attacks[0]));
    if(dc.length===1){put(fp('Spell DC'),dc[0]);put(fp('Spells Save'),dc[0]);}
    if(character.inventoryRows?.length){const equipped=character.inventoryRows.filter(i=>i.equipped),packed=character.inventoryRows.filter(i=>!i.equipped);const line=i=>`${i.quantity>1?i.quantity+' × ':''}${i.name}`;put('Back_Backpack',[equipped.length?'EQUIPPED\n'+equipped.map(line).join('\n'):'',packed.length?'PACK\n'+packed.map(line).join('\n'):''].filter(Boolean).join('\n\n'));put('Back_Armour',equipped.filter(i=>i.category==='Armor'&&i.armourType!==4).map(i=>i.name).join(', '));}
  }else if(spells.length){put('AttacksSpellcasting',['SPELLS (full details on page 2)',spells.map(s=>`${s.name} (${s.level===0?'C':s.level})`).join(', '),'WEAPONS — base rolls; conditional bonuses separate',...weapons.map(w=>`${w.name}: ${w.notes.replace('Base roll; conditional bonuses not included.','')}`)].filter(Boolean).join('\n'));}
  // Sort by actual vertical location: the alternative sheet reverses the physical boxes.
  abilityNames.forEach((key,i)=>{
    const short=key.slice(0,3),cap=short[0].toUpperCase()+short.slice(1);
    const names=isClass?[fp(`${cap} Score`),fp(`${cap} Mod`)]:[short.toUpperCase(),['STRmod','DEXmod ','CONmod','INTmod','WISmod','CHamod'][i]];
    const pair=names.map(n=>layout.find(f=>f.name===n));
    if(pair.some(f=>!f))throw new Error(`Template is missing ${key} boxes.`);
    pair.sort((a,b)=>b.rect[1]-a.rect[1]);
    const a=character.abilities[key],modifierFirst=options.abilityOrder==='modifier-first';
    put(pair[0].name,modifierFirst?signed(a.modifier):a.score);put(pair[1].name,modifierFirst?a.score:signed(a.modifier));
    pair.forEach((f,index)=>{f.center=true;f.ability=true;f.semanticName=`${key}.${index===0?(modifierFirst?'modifier':'score'):(modifierFirst?'score':'modifier')}`;});
    const save=character.saves.find(s=>s.name===key);
    if(save){put(isClass?fp(`${cap} Save Throw`):alt?`SavingThrows${i?i+1:''}`:`ST ${key[0].toUpperCase()+key.slice(1)}`,signed(save.bonus));
      put(isClass?fp(`Save ${cap}`):alt?`ST ${key[0].toUpperCase()+key.slice(1)}`:`Check Box ${i===0?11:17+i}`,save.proficient);}
  });
  const standardChecks={Acrobatics:23,'Animal Handling':24,Arcana:25,Athletics:26,Deception:27,History:28,Insight:29,Intimidation:30,Investigation:31,Medicine:32,Nature:33,Perception:34,Performance:35,Persuasion:36,Religion:37,'Sleight of Hand':38,Stealth:39,Survival:40};
  for(const skill of character.skills){
    let key=skill.name==='Sleight of Hand'?'SleightofHand':skill.name==='Animal Handling'&&!alt?'Animal':skill.name;
    const existing=layout.find(f=>f.name.trim()===key);
    put(isClass?fp(`Skill ${skill.name}`):(existing?.name??key),signed(skill.bonus));
    put(isClass?fp(`Proficiency ${skill.name}`):alt?`ChBx ${{'Animal Handling':'Animal','Sleight of Hand':'Sleight'}[skill.name]??skill.name}`:`Check Box ${standardChecks[skill.name]}`,skill.proficient);
    if(isClass)put(fp(`Expertise ${skill.name}`),skill.expertise);
  }
  put(isClass?'Back_Character Name':'CharacterName 2',identity.name);
  for(const key of ['age','height','weight','eyes','skin','hair'])put(isClass?`Back_${key[0].toUpperCase()+key.slice(1)}`:key[0].toUpperCase()+key.slice(1),d[key]);
  for(const [key,off,cls] of [['personalityTraits','PersonalityTraits ','Personality Traits'],['ideals','Ideals','Ideals'],['bonds','Bonds','Bonds'],['flaws','Flaws','Flaws']])put(isClass?`Back_${cls}`:off,d[key]);
  put(isClass?'Back_Background':'Backstory',d.backstory);put(isClass?'Back_Allies':'Allies',[d.allies,d.organizations?'Organizations: '+d.organizations:'',!isClass&&d.enemies?'Enemies: '+d.enemies:''].filter(Boolean).join('\n\n'));if(isClass)put('Back_Enemies',d.enemies);
  if(!isClass||!character.inventoryRows?.length)put(isClass?'Back_Backpack':'Equipment',[displayItems(character.equipment),alt?coinLine(character.coins):''].filter(Boolean).join('\n\n'));
  put(isClass?'Back_Additional Features & Traits':'Features and Traits',[character.features,!isClass&&character.combat.hitDiceUsed!=null?'Hit dice used: '+character.combat.hitDiceUsed:'',!isClass&&character.featureUses?.length?'Feature uses remaining: '+character.featureUses.map(u=>`${u.name}: ${u.remaining}/${u.maximum}`).join('; '):'',!isClass&&character.spellSlots?.length?'Spell slots: '+character.spellSlots.map(s=>`level ${s.level}: ${s.total} total${s.used==null?'':', '+s.used+' used'}`).join('; '):''].filter(Boolean).join('\n\n'));
  const holdingsKey=layout.some(f=>f.name==='Treasure')?'Treasure':isClass?'Back_Backpack':'Equipment';
  for(const [label,content] of [['Personal possessions',d.personalPossessions],['Other holdings',d.otherHoldings]]){if(content){const key=holdingsKey;put(key,[values[key],label+':\n'+content].filter(Boolean).join('\n\n'));}}
  if(d.appearance){const portrait=layout.find(f=>/^(CHARACTER IMAGE|Back_Character Portrait)$/.test(f.name));if(portrait&&!options.portrait){layout.push({...portrait,name:'Character appearance',type:'/Tx',pushbutton:false,multiline:true,value:''});put('Character appearance',d.appearance);}else overflow.push({label:'Appearance',text:clean(d.appearance)});}
  if(!isClass&&d.otherNotes)overflow.push({label:'Other notes',text:clean(d.otherNotes)});
  for(const coin of ['cp','sp','ep','gp','pp'])put(isClass?`Back_${coin.toUpperCase()}`:coin.toUpperCase(),character.coins?.[coin]??0);

  put(isClass?fp('Tools'):'ProficienciesLang',[character.proficiencies,isClass?'':character.languages].filter(Boolean).join('\n'));
  if(isClass){
    const remaining=new Set(character.featureRows??[]);
    const render=f=>`${f.name}: ${f.summary}${f.reference?' ['+f.reference+']':''}`;
    const racial=[...remaining].filter(f=>f.group==='Racial traits');
    if(layout.some(f=>f.name===fp('Racial Traits'))){put(fp('Racial Traits'),racial.map(render).join('\n'));racial.forEach(f=>remaining.delete(f));}
    put(fp('Languages'),character.languages);
    const profs=(character.proficiencies??'').split(', ').filter(Boolean);
    const categories=['Light Armour','Medium Armour','Heavy Armour','Simple Weapons','Martial Weapons','Shields'];
    const norm=v=>v.toLowerCase().replaceAll('armour','armor');
    for(const category of categories)put(fp(category),profs.some(p=>norm(p)===norm(category)));
    put(fp('Tools'),profs.filter(p=>!categories.some(c=>norm(c)===norm(p))).join(', '));
    const style=[...remaining].find(f=>['Archery','Defense','Dueling','Great Weapon Fighting','Protection','Two-Weapon Fighting'].includes(f.name));
    if(style&&layout.some(f=>f.name===fp('Fighting Style'))){put(fp('Fighting Style'),render(style));remaining.delete(style);}
    const maxLevel=Math.max(...character.classes.map(c=>c.level));
    for(const field of layout.filter(f=>f.page===0&&f.type==='/Tx'&&f.rect[3]-f.rect[1]>30&&f.rect[2]-f.rect[0]>90)){
      const label=field.name.replace(/^Front_/,'').replace(/-Arc\d+|-Alt/g,'');
      const level=label.match(/(?:Archetype|Feature|Oath|Origin|Patron|Tradition) (\d+)$/);
      const matches=[...remaining].filter(f=>level?f.group==='Subclass features'&&f.level===Number(level[1])&&f.level<=maxLevel:norm(f.name)===norm(label));
      if(matches.length){put(field.name,matches.map(render).join('\n'));matches.forEach(f=>remaining.delete(f));}
    }
    const extra=[...remaining].map(render);
    const unplacedUses=(character.featureUses??[]).filter(u=>!layout.some(f=>f.name===fp(u.name)&&f.rect[2]-f.rect[0]<90));
    if(unplacedUses.length)extra.push('Feature uses remaining: '+unplacedUses.map(u=>`${u.name}: ${u.remaining}/${u.maximum}`).join('; '));
    if(d.otherNotes)extra.push('Other notes: '+d.otherNotes);
    if(character.spellSlots?.length)extra.push('Spell slots: '+character.spellSlots.map(s=>`level ${s.level}: ${s.total} total${s.used==null?'':', '+s.used+' used'}`).join('; '));
    if(weapons.length)extra.push('WEAPONS (base rolls; conditional bonuses separate)\n'+weapons.map((w,i)=>`${w.name}: ${w.notes.replace('Base roll; conditional bonuses not included.','')}${i>=weaponSlots.length?' Attack '+(w.attackBonus==null?'check':signed(w.attackBonus))+'; '+w.damage:''}`).join('\n'));
    if(options.playerName)extra.push('Player: '+options.playerName);
    if(character.featureRows?.length||extra.length)put('Back_Additional Features & Traits',extra.join('\n\n'));
  }
  // Spells remain complete and readable on editable continuation pages.
  if(character.spells&&!options.spellResource)overflow.push({label:'Spells',text:clean(character.spells)});
  // Multiline boxes: shrink to fit, and give related boxes one shared size so they read as a set.
  const isMultiline=f=>f.type==='/Tx'&&!f.ability&&!/^(HPCurrent|HPTemp|Front_(?:Current HP|Temp HP)(?:-.*)?)$/.test(f.name)&&(f.multiline||f.rect[3]-f.rect[1]>45);
  const boxFor=f=>{
    const [x,y,right,top]=f.rect;
    // Class feature boxes on the right of the front page carry a level badge in their top corner.
    const badge=isClass&&f.page===0&&x>=400&&right-x>120?26:0;
    // Official personality boxes print their caption inside the field's bottom edge.
    const caption=!isClass&&/^(PersonalityTraits|Ideals|Bonds|Flaws)$/.test(f.name.trim())?5:0;
    // Favourite-spell effects are one-line reminders; the spell cards hold the full text.
    const reminder=/Spell Effect \d/.test(f.name)&&f.page===0;
    return {width:Math.max(20,right-x-4-badge),height:top-y-3-caption,max:isClass?8:10,min:reminder?5:isClass||caption?6:7,reminder};
  };
  const groupOf=f=>{
    const base=f.name.trim().replace(/^Back_/,'').replace(/-Arc\d+|-Alt/g,'');
    if(/^(PersonalityTraits|Personality Traits|Ideals|Bonds|Flaws)$/.test(base))return 'personality';
    if(isClass&&/^(Allies|Enemies)$/.test(base))return 'allies';
    if(isClass&&f.page===0&&f.rect[0]>=400)return 'class-features';
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
    const description=name.replace(/^(Front_|Back_)/,'').replace(/-Arc2|-Alt/g,'').replace(/[_.]/g,' ').replace(/\bAC\b/g,'Armour Class').replace(/\bHP\b/g,'Hit Points');
    if(form.getFieldMaybe(name))continue;
    if(f.type==='/Btn'){
      const check=form.createCheckBox(name);check.acroField.dict.set(PDFLib.PDFName.of('TU'),PDFLib.PDFHexString.fromText(description));check.addToPage(pages[f.page],{x,y,width,height,borderWidth:0,backgroundColor:undefined,borderColor:undefined});if(values[f.name]===true)check.check();check.updateAppearances((field,widget)=>({normal:{on:PDFLib.drawCheckMark({x:width/2,y:height/2,size:Math.min(width,height)/2,thickness:1,color:rgb(0,0,0)}),off:[]}}));continue;
    }
    if(f.type!=='/Tx')continue;
    let value=clean(Object.hasOwn(values,f.name)?values[f.name]:f.value);
    const field=form.createTextField(name);field.acroField.dict.set(PDFLib.PDFName.of('TU'),PDFLib.PDFHexString.fromText(description));
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
      // Leave room for the concentration bubble printed inside the class sheet's casting-time boxes.
      const inset=/Spell Casting Time/.test(f.name)?9:4;
      size=Math.max(5,Math.min(size,(width-inset)/Math.max(1,font.widthOfTextAtSize(value||' ',1))));
    }
    field.setText(value);field.addToPage(pages[f.page],{x,y,width,height,font,borderWidth:0,backgroundColor:undefined,borderColor:undefined});field.setFontSize(size);
    const numericStat=!multiline&&(/^[+-]?\d+(?:\s*(?:ft|d\d+))?$/.test(value)||/^(AC|HPMax|HPCurrent|HPTemp|Initiative|Speed|ProfBonus|Passive|HDTotal|HD|Front_(?:AC|Max HP|Current HP|Temp HP|Initiative|Speed|Proficiency|Passive Perception|Total Hit Dice|Hit Dice)(?:-.*)?)$/.test(f.name));
    field.setAlignment(f.center||numericStat||f.align===1?TextAlignment.Center:TextAlignment.Left);
  }
  if(options.portrait){
    const f=layout.find(f=>/CHARACTER IMAGE|Back_Character Portrait/.test(f.name));
    if(f){const [x,y,r,t]=f.rect,img=await doc.embedPng(options.portrait),scale=Math.min((r-x)/img.width,(t-y)/img.height);pages[f.page].drawImage(img,{x:x+(r-x-img.width*scale)/2,y:y+(t-y-img.height*scale)/2,width:img.width*scale,height:img.height*scale});}
  }
  if(options.spellResource)await appendClassSpells(PDFLib,doc,form,font,character.spellRows,options.spellResource,clean,character.spellSlots);
  // Official sheets: fill the empty "Additional features & traits" panel before adding pages.
  if(!isClass&&overflow.length){
    const target=form.getTextField('Feat+Traits'),f=layout.find(f=>f.name==='Feat+Traits');
    // Long spell lists read best last, after shorter continued notes.
    overflow.sort((a,b)=>(a.label==='Spells')-(b.label==='Spells'));
    if(f&&!target.getText()){
      const [x,y,right,top]=f.rect;
      const fit=fitText(overflow.map(g=>`${headingFor(g)}\n${g.text}`).join('\n\n'),font,{width:right-x-4,height:top-y-3,max:9,min:7,marker:'(Continued on the next page)'});
      target.enableMultiline();target.setText(fit.text);target.setFontSize(fit.size);
      overflow.splice(0,overflow.length,...(fit.rest?[{label:'Additional features & traits',text:fit.rest,continued:true}]:[]));
    }
  }
  await appendContinuations(PDFLib,doc,form,font,overflow.map(g=>({...g,label:headingFor(g)})),options,clean);
  form.updateFieldAppearances(font);doc.setTitle(`${clean(identity.name)} — 5e Character Sheet`);
  doc.setSubject(`5e; ${options.abilityOrder==='modifier-first'?'Modifier above score':'Score above modifier'}`);
  return {bytes:await doc.save(),warnings};
}
