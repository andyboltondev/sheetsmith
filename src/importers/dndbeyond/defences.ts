import { plainText } from './text.ts';
import { characterModifiers } from './modifiers.ts';
type Data=Record<string,any>;
const senseTypes=['blindsight','darkvision','tremorsense','truesight'];
const title=(v:string)=>v.replace(/^./,c=>c.toUpperCase());
// Senses, damage defences and save notes. Restricted modifiers are kept here because the restriction is the rule text ("Against Poison").
export function defences(raw:Data){
 const mods=characterModifiers(raw);
 const range=new Map<string,number>();
 for(const m of mods)if(m.type==='set-base'&&senseTypes.includes(m.subType)&&typeof m.value==='number')range.set(m.subType,Math.max(range.get(m.subType)??0,m.value));
 const senses=senseTypes.filter(s=>range.has(s)).map(s=>`${title(s)} ${range.get(s)} ft.`);
 const list=(type:string)=>[...new Set(mods.filter(m=>m.type===type).map(m=>plainText(m.friendlySubtypeName??String(m.subType??'').replaceAll('-',' '))+(m.restriction?` (${plainText(m.restriction).toLowerCase()})`:'')).filter(Boolean))];
 const saveNotes=[...new Set(mods.filter(m=>['advantage','disadvantage'].includes(m.type)&&m.subType==='saving-throws').map(m=>`${title(m.type)} on saving throws${m.restriction?' '+plainText(m.restriction).toLowerCase():''}`))];
 return {senses,defences:{resistances:list('resistance'),immunities:list('immunity'),vulnerabilities:list('vulnerability'),saveNotes}};
}
