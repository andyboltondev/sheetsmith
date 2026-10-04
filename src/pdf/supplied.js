import { appendClassSpells, appendOfficialSpells } from './spells.js';
import { appendContinuations } from './continuation.js';
import { coinLine, createCleaner, displayItems, dotAppearance, embedPortrait, fieldFactory, fitText, loadPdf, savePdf, signed } from './generator.js';
const abilityNames = ['strength','dexterity','constitution','intelligence','wisdom','charisma'];
// Reader-facing names for template fields, used to title continued text.
const fieldLabels = {PersonalityTraits:'Personality traits',AttacksSpellcasting:'Attacks & spellcasting','Features and Traits':'Features & traits',ProficienciesLang:'Other proficiencies & languages',Backstory:'Character backstory',Allies:'Allies & organizations','Feat+Traits':'Additional features & traits','Additional Features & Traits':'Additional features & traits',Background:'Background',Backpack:'Backpack & storage'};
const fieldLabel = name => { const base=name.trim().replace(/^(Front_|Back_)/,'').replace(/-Arc\d+|-Alt/g,''); return fieldLabels[base]??base.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/ (\d+)$/,' (level $1)'); };
// Every continued box points to the matching panel, whether on page 2 or on an added page.
export const PROFICIENCY_ONLY = 'Included in proficiencies.';
const CONTINUED_MARKER = '(Continued in Additional Features & Traits)';
const headingFor = group => `${group.label.toUpperCase()}${group.continued?' (CONTINUED)':''}`;
// Where equipped magic items are worn, for the class sheet's equipment slots. Rings fill both ring slots.
const wornSlots = [['Head',/\b(helm|helmet|hat|cap|circlet|headband|crown|diadem|goggles|mask)\b/i],['Amulet',/\b(amulet|necklace|periapt|medallion|brooch|pendant|scarab|talisman)\b/i],['Cloak',/\b(cloak|cape|mantle)\b/i],['Arms',/\b(gauntlets|gloves|bracers)\b/i],['Ring1',/\bring\b/i],['Ring2',/\bring\b/i],['Belt',/\b(belt|girdle)\b/i],['Boots',/\b(boots|slippers)\b/i]];
const itemTags = i => [i.rarity,i.attunement?(i.attuned?'attuned':'requires attunement'):''].filter(Boolean).join(', ');
export async function generateSuppliedPdf(PDFLib, character, options) {
  const {StandardFonts,TextAlignment}=PDFLib;
  const doc=await loadPdf(PDFLib,options.templateBytes);
  doc.setLanguage('en-GB');
  const form=doc.getForm(),fields=fieldFactory(PDFLib,form),font=await doc.embedFont(StandardFonts.Helvetica);
  const pages=doc.getPages(),warnings=[],overflow=[];
  const layout=structuredClone(options.layout);
  const isClass=options.templateId.startsWith('class-'),alt=options.templateId==='official-alternative';
  const clean=createCleaner(font,warnings);
  const values={},overflowLabels={};
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
  const front=layout.find(f=>f.name.startsWith('Front_Character Name'))?.name.replace('Front_Character Name','')??'';
  const fp=k=>`Front_${k}${front}`;
  const set=(official,cls,v)=>put(isClass?fp(cls):official,v);
  set('CharacterName','Character Name',identity.name);set('ClassLevel','Level',isClass?character.classes.reduce((s,c)=>s+c.level,0):classLevel);
  set('Race ','Race',identity.species);set('Background','Background',identity.background);set('Alignment','Alignment',identity.alignment??'');
  put('PlayerName',options.playerName||identity.playerName);put(fp('Archetype'),character.classes.map(c=>c.subclass).filter(Boolean).join(' / '));
  set('ProfBonus','Proficiency',signed(character.proficiencyBonus));set('AC','AC',character.combat.armourClass);
  set('Initiative','Initiative',signed(character.combat.initiative));set('Speed','Speed',character.combat.speed);
  set('HPMax','Max HP',character.combat.maxHP);set('Passive','Passive Perception',character.passivePerception);
  set('XP','XP',character.advancement==='milestone'&&character.experience!==''?'Milestone':character.experience);set('HPCurrent','Current HP',character.combat.currentHP);set('HPTemp','Temp HP',character.combat.temporaryHP);put(fp('Used Hit Dice'),character.combat.hitDiceUsed);
  if(isClass){const inspiration=layout.find(f=>f.name===fp('Inspiration'));put(fp('Inspiration'),inspiration?.type==='/Btn'?character.inspiration:character.inspiration?'Yes':'');const insight=character.skills.find(s=>s.name==='Insight');if(character.passiveInsight!=null||insight)put(fp('Passive Insight'),character.passiveInsight??10+insight.bonus);for(const use of character.featureUses??[]){const field=layout.find(f=>f.name===fp(use.name)&&f.rect[2]-f.rect[0]<90);if(field)put(field.name,use.remaining);}}else put('Inspiration',character.inspiration?'Yes':'');
  set('HDTotal','Total Hit Dice',character.classes.reduce((s,c)=>s+c.level,0));put('HD',character.combat.hitDice);
  const putTrim=(key,v)=>{const f=layout.find(f=>f.name.trim()===key);if(f)put(f.name,v);};
  const weapons=character.weapons??[];
  // Older imports have no attack rows; fall back to weapons only.
  const attacks=character.attacks??weapons.map(w=>({...w,source:'weapon'}));
  const hit=a=>a.attackBonus!=null?signed(a.attackBonus):a.save??'Check';
  const baseNote=n=>n.replace(/;? ?Base roll; conditional bonuses not included\./,'').trim();
  const weaponSlots=isClass?layout.filter(f=>/^Front_Weapon Name \d/.test(f.name)).sort((a,b)=>Number(a.name.match(/Name (\d+)/)[1])-Number(b.name.match(/Name (\d+)/)[1])):layout.filter(f=>/^Wpn Name/.test(f.name)).sort((a,b)=>b.rect[1]-a.rect[1]);
  weaponSlots.forEach((f,i)=>{const w=attacks[i];if(!w)return;put(f.name,w.name);if(isClass){put(f.name.replace('Weapon Name','Weapon Atk Bonus'),hit(w));put(f.name.replace('Weapon Name','Weapon Damage'),w.damage);}else{putTrim(`Wpn${i+1} AtkBonus`,hit(w));putTrim(`Wpn${i+1} Damage`,w.damage);}});
  // Rows that did not fit the table, then notes for the rows that did.
  const attackLines=[...attacks.slice(weaponSlots.length).map(a=>`${a.name}: ${hit(a)}, ${a.damage}${a.notes?' ('+baseNote(a.notes)+')':''}`),...attacks.slice(0,weaponSlots.length).filter(a=>a.source==='weapon'&&baseNote(a.notes)).map(a=>`${a.name}: ${baseNote(a.notes)}`)];
  const spells=character.spellRows??[];
  const magic=(character.inventoryRows??[]).filter(i=>i.magic).sort((a,b)=>Number(!!b.attuned)-Number(!!a.attuned)||Number(b.equipped)-Number(a.equipped));
  if(isClass){
    for(const field of layout){const match=field.name.match(/Spell Slot (\d)(?:st|nd|rd|th) (\d)/);if(match){const slot=character.spellSlots?.find(s=>s.level===Number(match[1]));if(slot?.used!=null)put(field.name,Number(match[2])<=Math.min(slot.used,slot.total));}}
    const names=layout.filter(f=>/^Front_Spell Name \d/.test(f.name)).sort((a,b)=>Number(a.name.match(/Name (\d+)/)[1])-Number(b.name.match(/Name (\d+)/)[1]));
    names.forEach((f,i)=>{const spell=spells[i];if(!spell)return;put(f.name,spell.name);put(f.name.replace('Spell Name','Spell Level'),spell.level===0?'C':spell.level);put(f.name.replace('Spell Name','Spell Ritual'),spell.ritual);});
    const favourites=layout.filter(f=>/^Front_Spell Attack Name \d/.test(f.name)).sort((a,b)=>b.rect[1]-a.rect[1]);
    favourites.forEach((f,i)=>{const spell=spells[i];if(!spell)return;put(f.name,spell.name);for(const [key,value] of [['Range',spell.range],['Casting Time',spell.casting],['Save',spell.requiresSave?`${spell.savingThrow} ${spell.saveDC??'?'}`:spell.requiresAttack&&spell.attackBonus!=null?signed(spell.attackBonus)+' atk':'—'],['Concentration',spell.concentration],['Effect',`${spell.summary.split('. ')[0].replace(/\.$/,'')}. ${spell.reference}`]]){const name=f.name.replace('Spell Attack Name','Spell '+key);put(name,value);if(key==='Effect'){const field=layout.find(v=>v.name===name);if(field)field.multiline=true;}}});
    const attacks=[...new Set(spells.map(s=>s.attackBonus).filter(v=>v!=null))],dc=[...new Set(spells.map(s=>s.saveDC).filter(v=>v!=null))];
    if(attacks.length===1)put(fp('Spell Atk'),signed(attacks[0]));
    if(dc.length===1){put(fp('Spell DC'),dc[0]);put(fp('Spells Save'),dc[0]);}
    if(character.inventoryRows?.length){const equipped=character.inventoryRows.filter(i=>i.equipped),packed=character.inventoryRows.filter(i=>!i.equipped);const line=i=>itemLine(i,false);put('Back_Backpack',[equipped.length?'EQUIPPED\n'+equipped.map(line).join('\n'):'',packed.length?'PACK\n'+packed.map(line).join('\n'):'',carryLine].filter(Boolean).join('\n\n'));put('Back_Armour',equipped.filter(i=>i.category==='Armor'&&i.armourType!==4).map(i=>i.name).join(', '));
      const free=equipped.filter(i=>!['Weapon','Armor'].includes(i.category));
      for(const [slot,pattern] of wornSlots){const item=free.find(i=>pattern.test(i.name));if(item){put(`Back_${slot}`,item.name);put(`Attune_${slot}`,!!item.attuned);free.splice(free.indexOf(item),1);}}}
    // Magic item boxes take a short effect each; longer text continues under the item's own name.
    magic.slice(0,5).forEach((i,n)=>{const k=String(n+1).padStart(2,'0');put(`Back_Item Name ${k}`,i.name);put(`Attune_Item ${k}`,!!i.attuned);put(`Back_Item Effect ${k}`,i.summary??'');overflowLabels[`Back_Item Effect ${k}`]=i.name;const f=layout.find(f=>f.name===`Back_Item Effect ${k}`);if(f)f.multiline=true;});
  }else put('AttacksSpellcasting',[...attackLines,spells.length?(options.spellResource?'Spells: see the spellcasting page.':'Spells: '+spells.map(s=>`${s.name} (${s.level===0?'C':s.level})`).join(', ')):''].filter(Boolean).join('\n'));
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
  if(!isClass||!character.inventoryRows?.length)put(isClass?'Back_Backpack':'Equipment',[character.inventoryRows?.length?character.inventoryRows.map(i=>itemLine(i,true)).join('\n'):displayItems(character.equipment),carryLine,alt?coinLine(character.coins):''].filter(Boolean).join('\n\n'));
  put(isClass?'Back_Additional Features & Traits':'Features and Traits',[character.features,!isClass&&(character.combat.hitDiceUsed!=null||tracking)?'Hit dice used: '+(character.combat.hitDiceUsed??'__'):'',!isClass&&character.featureUses?.length?'Feature uses remaining: '+character.featureUses.map(useText).join('; '):'',!isClass&&character.spellSlots?.length?'Spell slots: '+character.spellSlots.map(slotText).join('; '):''].filter(Boolean).join('\n\n'));
  const holdingsKey=layout.some(f=>f.name==='Treasure')?'Treasure':isClass?'Back_Backpack':'Equipment';
  for(const [label,content] of [['Personal possessions',d.personalPossessions],['Other holdings',d.otherHoldings]]){if(content){const key=holdingsKey;put(key,[values[key],label+':\n'+content].filter(Boolean).join('\n\n'));}}
  // The printed details boxes stop at hair; gender, size, faith and lifestyle lead the appearance text instead.
  const identityLine=[['Gender','gender'],['Size','size'],['Faith','faith'],['Lifestyle','lifestyle']].filter(([,k])=>d[k]).map(([n,k])=>`${n}: ${d[k]}`).join(' · ');
  const appearance=[identityLine,d.appearance].filter(Boolean).join('\n\n');
  if(appearance){const portrait=layout.find(f=>/^(CHARACTER IMAGE|Back_Character Portrait)$/.test(f.name));if(portrait&&!options.portrait){layout.push({...portrait,name:'Character appearance',type:'/Tx',pushbutton:false,multiline:true,value:''});put('Character appearance',appearance);}else overflow.push({label:'Appearance',text:clean(appearance)});}
  if(!isClass&&d.otherNotes)overflow.push({label:'Other notes',text:clean(d.otherNotes)});
  if(!isClass&&magic.length)overflow.push({label:'Magic items',text:clean(magic.map(i=>`${i.name}${itemTags(i)?' ('+itemTags(i)+')':''}: ${i.summary}`).join('\n'))});
  for(const coin of ['cp','sp','ep','gp','pp'])put(isClass?`Back_${coin.toUpperCase()}`:coin.toUpperCase(),character.coins?.[coin]===null?'':character.coins?.[coin]??0);

  const def=character.defences??{},sensesBlock=[
    isClass?(character.passiveInvestigation!=null?`Passive Investigation ${character.passiveInvestigation}`:''):[character.passiveInsight!=null?`Passive Insight ${character.passiveInsight}`:'',character.passiveInvestigation!=null?`Passive Investigation ${character.passiveInvestigation}`:''].filter(Boolean).join(' · '),
    character.senses?.length?'Senses: '+character.senses.join(', '):'',character.speeds?.length?'Speeds: '+character.speeds.join(', '):'',
    def.resistances?.length?'Resistances: '+def.resistances.join(', '):'',def.immunities?.length?'Immunities: '+def.immunities.join(', '):'',def.vulnerabilities?.length?'Vulnerabilities: '+def.vulnerabilities.join(', '):'',
    ...(def.saveNotes??[])].filter(Boolean).join('\n');
  // Training grouped as D&D Beyond prints it: armour, weapons, tools, then languages.
  const pg=character.proficiencyGroups,training=pg?[['Armour',pg.armour],['Weapons',pg.weapons],['Tools',pg.tools]].filter(([,v])=>v?.length).map(([n,v])=>`${n}: ${v.join(', ')}`).join('\n'):character.proficiencies;
  put(isClass?fp('Tools'):'ProficienciesLang',[isClass?'':sensesBlock,training,isClass?'':character.languages&&'Languages: '+character.languages].filter(Boolean).join('\n\n'));
  if(isClass){
    const remaining=new Set(character.featureRows??[]);
    const render=f=>`${f.name}: ${f.summary}${f.reference?' ['+f.reference+']':''}`;
    // Traits whose effect is only a proficiency share one line, so they do not crowd the rules text.
    const renderAll=(rows,sep='\n')=>{const covered=rows.filter(f=>f.summary===PROFICIENCY_ONLY),refs=[...new Set(covered.map(f=>f.reference).filter(Boolean))];
      return [...rows.filter(f=>!covered.includes(f)).map(render),covered.length?`${covered.map(f=>f.name).join(', ')}: included in proficiencies.${refs.length?' ['+refs.join('; ')+']':''}`:''].filter(Boolean).join(sep);};
    const racial=[...remaining].filter(f=>f.group==='Racial traits');
    if(layout.some(f=>f.name===fp('Racial Traits'))){put(fp('Racial Traits'),renderAll(racial));racial.forEach(f=>remaining.delete(f));}
    put(fp('Languages'),character.languages);
    const profs=(character.proficiencies??'').split(', ').filter(Boolean);
    const categories=['Light Armour','Medium Armour','Heavy Armour','Simple Weapons','Martial Weapons','Shields'];
    const norm=v=>v.toLowerCase().replaceAll('armour','armor');
    for(const category of categories)put(fp(category),profs.some(p=>norm(p)===norm(category)));
    // The checkboxes cover armour and weapon categories; this box takes tools, then any individually named weapons.
    const loose=pg?[...pg.tools,...pg.weapons.filter(p=>!categories.some(c=>norm(c)===norm(p)))]:profs.filter(p=>!categories.some(c=>norm(c)===norm(p)));
    put(fp('Tools'),loose.join(', '));
    const style=[...remaining].find(f=>['Archery','Defense','Dueling','Great Weapon Fighting','Protection','Two-Weapon Fighting'].includes(f.name));
    if(style&&layout.some(f=>f.name===fp('Fighting Style'))){put(fp('Fighting Style'),render(style));remaining.delete(style);}
    // Class resource boxes: pools from D&D Beyond's limited uses, dice from its scale values, otherwise the PHB class tables.
    const cls=character.classes[0],lvl=cls.level,kind=norm(cls.name),sub=norm(cls.subclass??''),mod=k=>character.abilities[k].modifier,prof=character.proficiencyBonus;
    const scale=(...names)=>character.classScales?.find(v=>names.some(n=>norm(v.name)===norm(n)))?.value;
    const tier=steps=>steps.reduce((value,[at,v])=>lvl>=at?v:value,'');
    const box=(name,value)=>{if(value!==''&&value!=null&&layout.some(f=>f.name===fp(name)))put(fp(name),value);};
    const placedUses=new Set();
    for(const [name,prefixes] of [['Rage',['Rage']],['Ki',['Ki','Ki Points']],['Sorcery Points',['Sorcery Points','Font of Magic']],['Superiority',['Superiority Dice','Combat Superiority']],['Wild Shape',['Wild Shape']],['Lay on Hands',['Lay on Hands','Lay on Hands Pool']],['Divine Sense',['Divine Sense']],['Grit',['Grit','Grit Points']],['Moxie',['Moxie']],['Psi',['Psi Points']]]){
      const use=(character.featureUses??[]).find(u=>prefixes.some(p=>norm(u.name)===norm(p)));
      if(!use||!layout.some(f=>f.name===fp(name+' Total')))continue;
      box(name+' Total',use.maximum);box(name+' Used',use.remaining==null?'':use.maximum-use.remaining);placedUses.add(use.name);
    }
    const shield=(character.inventoryRows??[]).find(i=>i.equipped&&i.armourType===4);
    if(shield)box('Shield Bonus',signed(shield.armourClass??2));
    box('Cantrips Known',spells.filter(s=>s.level===0).length||'');
    if(kind==='rogue')box('Sneak Attack',scale('Sneak Attack')??`${Math.ceil(lvl/2)}d6`);
    if(kind==='barbarian'){box('Rage Damage',signed(tier([[1,2],[9,3],[16,4]])));box('Brutal Critical Die',tier([[9,1],[13,2],[17,3]]));}
    if(kind==='bard')box('Song of Rest',scale('Song of Rest')??tier([[2,'d6'],[9,'d8'],[13,'d10'],[17,'d12']]));
    if(kind==='druid'&&lvl>=2)box('Wild Shape Max CR',sub.includes('moon')?String(lvl>=6?Math.floor(lvl/3):1):tier([[2,'1/4'],[4,'1/2'],[8,'1']]));
    if(kind==='fighter'){
      // PHB notation: Extra Attack (2) at 11th level means two extra attacks.
      box('Extra Attack',tier([[5,1],[11,2],[20,3]]));
      if(sub==='battle master'&&lvl>=3){box('Superiority Die',scale('Combat Superiority','Superiority Dice')??tier([[3,'d8'],[10,'d10'],[18,'d12']]));box('Maneuver DC',8+prof+Math.max(mod('strength'),mod('dexterity')));}
      if(sub==='gunslinger')box('Trick Shot DC',8+prof+mod('dexterity'));
    }
    if(kind==='pugilist')box('Fisticuffs Die',scale('Fisticuffs'));
    if(kind==='warlock')[6,7,8,9].forEach((l,i)=>{const s=spells.find(s=>s.level===l);if(s)box(`Arcanum ${i+1}`,s.name);});
    // Chosen options (metamagic, invocations, pact boon) replace the generic rule text in their boxes.
    for(const [name,parent,count] of [['Metamagic Options','Metamagic','Metamagic Known'],['Eldritch Invocations','Eldritch Invocations','Invocations Known'],['Pact Boon 3','Pact Boon','']]){
      const chosen=[...remaining].filter(f=>f.parent&&norm(f.parent)===norm(parent));
      if(!chosen.length||!layout.some(f=>f.name===fp(name)))continue;
      put(fp(name),chosen.map(render).join('\n'));
      for(const f of [...remaining])if(chosen.includes(f)||norm(f.name)===norm(parent))remaining.delete(f);
      if(count)box(count,chosen.length);
    }
    const channel=[...remaining].filter(f=>/^Channel Divinity:/i.test(f.name)&&f.group==='Subclass features');
    if(channel.length&&layout.some(f=>f.name===fp('Channel Divinity Domain'))){put(fp('Channel Divinity Domain'),channel.map(render).join('\n'));channel.forEach(f=>remaining.delete(f));}
    const maxLevel=Math.max(...character.classes.map(c=>c.level));
    for(const field of layout.filter(f=>f.page===0&&f.type==='/Tx'&&f.rect[3]-f.rect[1]>30&&f.rect[2]-f.rect[0]>90)){
      const label=field.name.replace(/^Front_/,'').replace(/-Arc\d+|-Alt/g,'');
      const level=label.match(/(?:Archetype|Feature|Oath|Origin|Patron|Tradition) (\d+)$/);
      const matches=[...remaining].filter(f=>level?f.group==='Subclass features'&&f.level===Number(level[1])&&f.level<=maxLevel:norm(f.name)===norm(label));
      if(matches.length){put(field.name,matches.map(render).join('\n'));matches.forEach(f=>remaining.delete(f));}
    }
    const extra=[sensesBlock,...Object.values(Object.groupBy([...remaining],f=>f.group||'')).map(rows=>renderAll(rows,'\n\n'))].filter(Boolean);
    const unplacedUses=(character.featureUses??[]).filter(u=>!placedUses.has(u.name)&&!layout.some(f=>f.name===fp(u.name)&&f.rect[2]-f.rect[0]<90));
    if(unplacedUses.length)extra.push('Feature uses remaining: '+unplacedUses.map(useText).join('; '));
    if(d.otherNotes)extra.push('Other notes: '+d.otherNotes);
    if(character.spellSlots?.length)extra.push('Spell slots: '+character.spellSlots.map(slotText).join('; '));
    if(attackLines.length)extra.push('ATTACKS (base rolls; conditional bonuses separate)\n'+attackLines.join('\n'));
    if(magic.length>5)extra.push('MAGIC ITEMS\n'+magic.slice(5).map(i=>`${i.name}${itemTags(i)?' ('+itemTags(i)+')':''}: ${i.summary}`).join('\n'));
    if(options.playerName||identity.playerName)extra.push('Player: '+(options.playerName||identity.playerName));
    if(character.featureRows?.length||extra.length)put('Back_Additional Features & Traits',extra.join('\n\n'));
  }
  // Spells remain complete and readable on editable continuation pages.
  // Class spell cards carry the full text; the official spellcasting page lists names only, so details follow it.
  const spellDetails=spells.map(s=>`${s.name} (${s.level===0?'cantrip':'level '+s.level}${s.ritual?', ritual':''}): ${[s.casting,s.range,s.duration+(s.concentration?' (C)':''),s.components,s.requiresSave?`${s.savingThrow} save DC ${s.saveDC??'?'}`:s.requiresAttack&&s.attackBonus!=null?signed(s.attackBonus)+' to hit':''].filter(Boolean).join(' · ')}. ${s.summary}${s.restriction?' '+s.restriction:''}${s.reference?' ['+s.reference+']':''}`).join('\n');
  if(character.spells&&(!isClass||!options.spellResource))overflow.push(options.spellResource&&spells.length?{label:'Spell details',text:clean(spellDetails)}:{label:'Spells',text:clean(character.spells)});
  // Multiline boxes: shrink to fit, and give related boxes one shared size so they read as a set.
  const isMultiline=f=>f.type==='/Tx'&&!f.ability&&!/^(HPCurrent|HPTemp|Front_(?:Current HP|Temp HP)(?:-.*)?)$/.test(f.name)&&(f.multiline||f.rect[3]-f.rect[1]>45);
  const boxFor=f=>{
    const [x,y,right,top]=f.rect;
    // Class feature boxes on the right of the front page carry a level badge in their top corner.
    const badge=isClass&&f.page===0&&x>=400&&right-x>120?26:0;
    // Official personality boxes print their caption inside the field's bottom edge.
    const caption=!isClass&&/^(PersonalityTraits|Ideals|Bonds|Flaws)$/.test(f.name.trim())?5:0;
    // Favourite-spell effects are one-line reminders; the spell cards hold the full text.
    const reminder=/Spell Effect \d/.test(f.name)&&f.page===0,item=/^Back_Item Effect \d/.test(f.name);
    return {width:Math.max(20,right-x-4-badge),height:top-y-3-caption,max:isClass?8:10,min:reminder||item?5:isClass||caption?6:7,reminder};
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
      if(fit.rest&&!box.reminder)overflow.push({label:overflowLabels[f.name]??fieldLabel(f.name),text:fit.rest,continued:true});
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
    if(f){const [x,y,r,t]=f.rect,img=await embedPortrait(doc,options.portrait),scale=Math.min((r-x)/img.width,(t-y)/img.height);pages[f.page].drawImage(img,{x:x+(r-x-img.width*scale)/2,y:y+(t-y-img.height*scale)/2,width:img.width*scale,height:img.height*scale});}
  }
  if(options.spellResource&&character.spellRows?.length){if(isClass)await appendClassSpells(PDFLib,doc,fields,font,character.spellRows,options.spellResource,clean,character.spellSlots);else await appendOfficialSpells(PDFLib,doc,fields,font,character,options.spellResource,clean);}
  // Official sheets: fill the empty "Additional features & traits" panel before adding pages.
  if(!isClass&&overflow.length){
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
