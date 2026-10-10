import { embedPortrait } from './generator.js';
import { M, RIGHT, signed } from './compact-kit.js';
// Identity band and the three vitals groups across the top of page one.
export async function drawHeader(ctx){
 const {p,c,options,kit,overflow}=ctx; const {PDFLib,doc,form,fields,warnings,font,bold,ink,muted,hair,accent,tint,white,clean,width,text,label,centred,rightLabel,rule,vrule,rbox,named,unique,field,dot,diamond,heading,ruled}=kit;
 // Identity band: name and summary line, with level, XP or milestone and portrait to the right.
 const level=c.classes.reduce((n,v)=>n+(v.level||0),0),portraitW=options.portrait?48:0;
 const milestone=c.advancement==='milestone',showXP=c.experience!=null||milestone;
 const statsW=showXP?110:40,nameW=RIGHT-M-portraitW-statsW-(portraitW?8:0);
 field(p,'CharacterName',c.identity.name,M-2,784,nameW,26,{size:21,f:bold});
 const player=options.playerName||c.identity.playerName;
 const identity=[c.identity.species,...c.classes.map(v=>`${v.name} ${v.level}${v.subclass?' ('+v.subclass+')':''}`),c.identity.background,c.identity.alignment,player?'Player: '+player:''].filter(Boolean).join('  ·  ');
 field(p,'Identity',identity,M-2,769,nameW+statsW-4,13,{size:8.5});
 {let x=RIGHT-portraitW-(portraitW?8:0);
  // A blanked export clears experience to '' so it can be pencilled in.
  if(showXP){rightLabel(p,milestone?'Advancement':'XP',x,801);field(p,'Experience',c.experience===''?'':milestone?'Milestone':c.experience,x-62,784,64,15,{size:milestone?10:12,align:'center'});x-=70;}
  rightLabel(p,'Level',x,801);text(p,String(level),x-width(String(level),15,bold),787.5,15,bold);}
 if(options.portrait){const image=await embedPortrait(doc,options.portrait),s=Math.min(portraitW/image.width,portraitW/image.height);p.drawImage(image,{x:RIGHT-portraitW+(portraitW-image.width*s)/2,y:765+(portraitW-image.height*s)/2,width:image.width*s,height:image.height*s});}
 rule(p,M,RIGHT,761,accent,1.2);

 // Vitals: defence and movement · hit points · recovery, each its own rounded group.
 const vy=717,vh=36,gap=6;
 const vgroups=[[['Armour class',c.combat.armourClass,'AC'],['Initiative',signed(c.combat.initiative),'Initiative'],['Speed',c.combat.speed==null?'':`${c.combat.speed} ft`,'Speed'],['Proficiency',signed(c.proficiencyBonus),'ProfBonus']],
  [['Max HP',c.combat.maxHP,'HPMax'],['Current HP',c.combat.currentHP??'','HPCurrent'],['Temp HP',c.combat.temporaryHP||'','HPTemp']],
  [['Hit dice',c.combat.hitDice,'HitDice'],['Death saves',null,'DeathSaves']]];
 const unit=(RIGHT-M-2*gap)/9.4;
 let vx=M;
 vgroups.forEach((cells,g)=>{const w=g===2?2.4*unit:cells.length*unit,cw=w/cells.length;
  rbox(p,vx,vy,w,vh,{fill:g===1?tint:undefined,border:g===1?undefined:hair});
  cells.forEach(([name,value,id],i)=>{const x=vx+i*cw;if(i)vrule(p,x,vy+6,vy+vh-6);
   centred(p,name,x,vy+vh-9.5,cw,6,g===1?accent:muted);
   if(id==='DeathSaves')[['Success',vy+17.5],['Failure',vy+7.5]].forEach(([kind,y])=>{label(p,kind[0],x+cw/2-20,y-2.2,6);for(let k=0;k<3;k++)dot(p,`DeathSave.${kind}.${k+1}`,x+cw/2-7+k*10,y,false,3);});
   else field(p,id,value,x+3,vy+4,cw-6,19,{size:id==='AC'||id==='HPMax'?16:14,align:'center',f:id==='AC'||id==='HPMax'?bold:font});});
  vx+=w+gap;});
}
