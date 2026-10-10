import { M, RIGHT, signed } from './compact-kit.js';
import { wrapText, lineHeight, ordinal } from './generator.js';
const RX=M,RW=RIGHT-M;
// Weapons, unarmed strikes and spell attacks as one table. Returns the y below it.
export function drawAttacks(ctx,y){
 const {p,c,options,kit,overflow}=ctx; const {PDFLib,doc,form,fields,warnings,font,bold,ink,muted,hair,accent,tint,white,clean,width,text,label,centred,rightLabel,rule,vrule,rbox,named,unique,field,dot,diamond,heading,ruled}=kit;
 let ry=y;
 heading(p,'Attacks',RX,ry,RW,'base rolls');ry-=6;
 // The base-roll caveat is stated once in the heading rather than on every row.
 const note=n=>String(n??'').replace(/;? ?Base roll; conditional bonuses not included\./,'').replace(/^; /,'').trim();
 const attackRow=a=>({name:a.name,hit:a.attackBonus!=null?signed(a.attackBonus):a.save??'',damage:a.damage,notes:note(a.notes)});
 // Damaging spells are short references here; their full text stays on the spells page.
 const spellRef=s=>({name:s.level?`${s.name} (${ordinal(s.level)})`:s.name,hit:s.requiresSave&&!s.requiresAttack?`${s.savingThrow} ${s.saveDC??'?'}`.trim():s.attackBonus!=null?signed(s.attackBonus):'',damage:s.damage??'',notes:`${s.range} · see Spells`});
 const spellsList=c.spellRows??[],isAttackSpell=s=>s.damage&&(s.requiresAttack||s.requiresSave);
 let attackList;
 if(c.attacks?.length){
  attackList=c.attacks.map(a=>a.source==='spell'?{...attackRow(a),notes:`${String(a.notes??'').split(';')[0]} · see Spells`}:attackRow(a));
  const kinds=c.attacks.map(a=>a.source);let at=kinds.lastIndexOf('spell');if(at<0){const u=kinds.indexOf('unarmed');at=u<0?attackList.length-1:u-1;}
  attackList.splice(at+1,0,...spellsList.filter(s=>s.level>0&&s.prepared&&isAttackSpell(s)).map(spellRef));
 }else attackList=[...(c.weapons??[]).map(w=>attackRow({name:w.name+(w.equipped?'':' (stowed)'),attackBonus:w.attackBonus,damage:w.damage,notes:w.notes})),...spellsList.filter(s=>s.level===0&&isAttackSpell(s)).map(spellRef)];
 const nlh=lineHeight(font,7),NX=RX+322,NWd=RW-322;
 // One table: weapons, unarmed strikes and spell attacks are all just attacks, followed by blank rows to pencil in.
 {rbox(p,RX,ry-10,RW,10,{fill:tint,border:undefined,r:2});label(p,'Name',RX+4,ry-7,6);centred(p,'Hit / DC',RX+134,ry-7,36,6);label(p,'Damage',RX+178,ry-7,6);label(p,'Range · properties · notes',NX+2,ry-7,6);ry-=10;
  // A long attack list must not push the actions off page one: with actions to show, the table stops at 6 rows and the rest continue overleaf.
  const rows=Math.min(c.actions?.length?6:12,Math.max(4,attackList.length+3));
  for(let i=0;i<rows;i++){const a=attackList[i]??{},notes=wrapText(clean((a.notes??'').replace(/; /g,'  ·  ')),font,7,NWd-4),shown=notes.length>3?[notes[0],notes[1],notes[2].replace(/[ ,;.]*$/,'')+' …']:notes,h=Math.max(2,shown.length)*nlh+6,y=ry-h;
   field(p,`Attack.${i+1}.Name`,a.name??'',RX+2,y+h-14,130,13,{size:8.4,f:bold});field(p,`Attack.${i+1}.Hit`,a.hit??'',RX+134,y+h-14,36,13,{size:8.4,align:'center'});
   field(p,`Attack.${i+1}.Damage`,a.damage??'',RX+176,y+h-14,142,13,{size:8});
   field(p,`Attack.${i+1}.Notes`,shown.join('\n'),NX,y+1,NWd,h-1,{size:7,multi:true});
   rule(p,RX,RX+RW,y,hair,.4);ry-=h;if(notes.length>3)overflow.push([`${a.name} (notes)`,a.notes]);}
  if(attackList.length>rows)overflow.push(['Attacks (continued)',attackList.slice(rows).map(a=>`${a.name}: ${a.hit} ${a.damage} ${a.notes}`.trim()).join('\n')]);}
 ry-=14;
 return ry;
}
