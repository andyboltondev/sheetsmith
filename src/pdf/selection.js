const normalise = name => String(name??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function resolveTemplate(catalog, character, style='official-standard') {
  if(style==='field-notes')return {id:'field-notes',name:'Field Notes — 5e',edition:'5e',family:'field-notes',generated:true};
  if(style==='class') {
    if(character.classes.length!==1)throw new Error('A matching combined class sheet is not available. Choose Official or Field Notes for this multiclass character.');
    const c=character.classes[0];const matches=catalog.filter(t=>t.characterClass&&normalise(t.characterClass)===normalise(c.name));
    const result=matches.find(t=>t.subclass&&normalise(t.subclass)===normalise(c.subclass))??matches.find(t=>!t.subclass);
    if(!result)throw new Error(`No class sheet matches ${c.name}. Choose Official or Field Notes.`);
    return result;
  }
  const result=catalog.find(t=>t.id===style&&!t.characterClass&&!t.resource);
  if(!result)throw new Error('Choose one of the available sheet styles.');
  return result;
}
