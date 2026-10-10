// How many spells a character may prepare. Only classes that prepare from a list have a limit; known-spell casters return null.
const RULES={Cleric:['wisdom',1],Druid:['wisdom',1],Wizard:['intelligence',1],Paladin:['charisma',.5],Artificer:['intelligence',.5]};
export function preparedLimit(character){
 const found=(character.classes??[]).filter(v=>RULES[v.name]);
 if(!found.length)return null;
 return found.reduce((n,v)=>{const [ability,share]=RULES[v.name];return n+Math.max(1,(character.abilities?.[ability]?.modifier??0)+Math.floor((v.level||0)*share));},0);
}
// Every levelled spell the character can choose between preparing or not.
export const preparable=character=>(character.spellRows??[]).filter(s=>s.level>0);
