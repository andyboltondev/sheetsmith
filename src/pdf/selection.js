export function resolveTemplate(catalog, character, style='official-standard') {
  if(style==='compact')return {id:'compact',name:'SheetSmith — 5e',edition:'5e',family:'compact',generated:true};
  const result=catalog.find(t=>t.id===style&&!t.resource);
  if(!result)throw new Error('Choose one of the available sheet styles.');
  return result;
}
