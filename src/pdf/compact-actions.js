import { M, RIGHT, BOTTOM, plural } from './compact-kit.js';
import { wrapText, lineHeight } from './generator.js';
import { classStats } from './class-info.js';
const RX=M,RW=RIGHT-M;
// Equipment spans the foot of page one, so the action columns stop above this line.
const FLOOR=BOTTOM+150;
// Actions by what they cost, with limited uses tracked beside them. Returns the y below them.
export function drawActions(ctx,y){
 const {p,c,options,kit,overflow}=ctx; const {PDFLib,doc,form,fields,warnings,font,bold,ink,muted,hair,accent,tint,white,clean,width,text,label,centred,rightLabel,rule,vrule,rbox,named,unique,field,dot,diamond,heading,ruled}=kit;
 let ry=y;
 // Actions by what they cost, in two columns, with limited uses tracked beside them.
 const spells=c.spellRows??[];
 const resetShort={'Short rest':'SR','Long rest':'LR','Dawn':'dawn'};
 const uses=c.featureUses??[],acts=c.actions??[];
 const actionGroups=[['Action',[]],['Bonus action',[]],['Reaction',[]],['Special',[]]];
 for(const a of acts)actionGroups.find(([g])=>g===a.activation)?.[1].push(a);

 const loose=uses.filter(u=>!acts.some(a=>a.name===u.name)).map(u=>[u.name+(resetShort[u.reset]?` (${resetShort[u.reset]})`:''),u.maximum,u.remaining==null?0:u.maximum-u.remaining,`Uses.${named(u.name)}`]);
 const hasActions=loose.length||actionGroups.some(g=>g[1].length);
 if(hasActions){heading(p,'Actions & resources',RX,ry,RW,'filled = used'+(uses.length?' · SR short rest · LR long rest':''));ry-=11;}
 const lw=(RW-2*18)/3;
 const tracker=(id,max,used,right,y)=>{if(max<=10){for(let k=0;k<max;k++)dot(p,`${id}.${k+1}`,right-(max-1-k)*8-3,y+2.6,k<used);return max*8;}field(p,id,`${max-used} / ${max}`,right-40,y-3,40,11,{size:8,align:'center'});return 40;};
 loose.forEach(([n,max,used,id],i)=>{const x=RX+(i%3)*(lw+18),y=ry-Math.floor(i/3)*12;
  const name=clean(n);let sz=7.5;while(sz>6&&font.widthOfTextAtSize(name,sz)>lw-Math.min(max,10)*8-6)sz-=.5;text(p,name,x,y,sz);tracker(id,max,used,x+lw,y);});
 if(loose.length)ry-=Math.ceil(loose.length/3)*12+2;
 // Class dice that grow with level (Sneak Attack 3d6) show beside the action they belong to.
 const scaleOf=n=>c.classScales?.find(v=>v.name===n&&/^\d*d\d+$/.test(v.value))?.value;
 // Numbers class features hand out (Rage damage, Extra Attack, maneuver DC…); dice already shown beside their action are not repeated.
 const traits=classStats(c).filter(t=>!acts.some(a=>a.name===t.label&&scaleOf(a.name)));
 if(traits.length){heading(p,'Class traits',RX,ry,RW);ry-=11;
  traits.forEach((t,i)=>{const x=RX+(i%3)*(lw+18),y=ry-Math.floor(i/3)*12,label=clean(t.label),value=clean(t.value);
   let sz=7.5;while(sz>6&&width(label,7.5,font)+width(value,sz,bold)+5>lw)sz-=.5;
   text(p,label,x,y,7.5,font,muted);text(p,value,x+width(label,7.5,font)+5,y,sz,bold);});
  ry-=Math.ceil(traits.length/3)*12+2;}
 // Space below is kept for the equipment; actions that do not fit continue overleaf.
 const floor=FLOOR+10,later=[],aw=(RW-16)/2,y0=ry;
 const entryHeight=e=>13+(e.summary?Math.min(3,wrapText(clean(e.summary),font,6.6,aw-10).length)*lineHeight(font,6.6)+6:2);
 const groupHeight=entries=>entries.length?22+entries.reduce((n,e)=>n+entryHeight(e),0):0;
 // Fill the left column up to half the total height, then continue in the right.
 const columns=[[],[]],used=[0,0],everything=actionGroups.reduce((n,[,e])=>n+groupHeight(e),0);
 for(const g of actionGroups){if(!g[1].length)continue;const k=used[0]>0&&used[0]+groupHeight(g[1])>everything/2+4?1:0;columns[k].push(g);used[k]+=groupHeight(g[1]);}
 let lowest=y0;
 columns.forEach((groups,k)=>{const ax=RX+k*(aw+16);let cy=y0,full=false;
  for(const [g,entries] of groups){
   const shown=[];for(const e of entries)if(!full&&cy-22-[...shown,e].reduce((n,x)=>n+entryHeight(x),0)>=floor)shown.push(e);else{full=true;later.push([g,e]);}
   if(!shown.length)continue;
   const title=g+(g==='Special'?'':'s');
   cy-=8;label(p,title,ax,cy-6,6,accent);rule(p,ax+width(title.toUpperCase(),6,bold)+5,ax+aw,cy-4,tint,.7);cy-=14;
   for(const e of shown){
    const use=uses.find(u=>u.name===e.name);
    text(p,e.name,ax+6,cy-7,7.8,bold);
    const aside=e.note??scaleOf(e.name);if(aside)text(p,aside,ax+10+width(e.name,7.8,bold),cy-7,6.3,font,muted);
    if(use){const r=resetShort[use.reset]??'';if(r)rightLabel(p,r,ax+aw,cy-7.4,6);tracker(`Uses.${named(use.name)}`,use.maximum,use.remaining==null?0:use.maximum-use.remaining,ax+aw-(r?width(r,6,bold)+5:0),cy-7.6);}
    cy-=12;
    if(e.summary){const lines=wrapText(clean(e.summary),font,6.6,aw-10),shown=lines.length>3?[...lines.slice(0,2),lines[2]+' …']:lines,h=shown.length*lineHeight(font,6.6)+2;
     field(p,`Action.${named(e.name)}`,shown.join('\n'),ax+4,cy-h,aw-4,h,{size:6.6,multi:true});cy-=h+6;}else cy-=2;
   }
  }
  lowest=Math.min(lowest,cy);});
 ry=lowest;
 // Actions that do not fit are already described under features; only those with no entry there continue overleaf.
 const carried=later.filter(([,e])=>!e.note&&!(c.featureRows??[]).some(f=>f.name===e.name));
 if(carried.length){overflow.push(['Actions (continued)',carried.map(([g,e])=>`${e.name} (${g.toLowerCase()}): ${e.summary}`).join('\n')]);text(p,`+ ${plural(carried.length,'more action')} overleaf`,RX+6,ry-8,6.3,font,muted);ry-=11;}
 ry-=18;
 return ry;
}
