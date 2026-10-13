// Keep the university's grouping and alternatives without exposing its table layout.
export function requirementText(table){
 const headers=table.headers.map(h=>h.trim().toLowerCase());
 const subject=headers.indexOf('subject'),number=headers.indexOf('course number');
 if(subject<0||number<0)return table.rows.map(row=>row.map((cell,i)=>cell?`${table.headers[i] ? table.headers[i]+': ' : ''}${cell}`:'').filter(Boolean).join(' · ')).join('\n');
 const at=(row,name)=>row[headers.indexOf(name)]||'';
 return table.rows.map(row=>{
   const course=[row[subject],row[number]].filter(Boolean).join(' ');
   const test=[at(row,'test'),at(row,'score')&&`score ${at(row,'score')}`].filter(Boolean).join(' — ');
   const grade=at(row,'grade');
   const level=at(row,'level');
   const rule=[course,test].filter(Boolean).join(' · ')+(grade?` (minimum grade ${grade})`:'')+(level&&level!=='Undergraduate'?` [${level}]`:'');
   const connector=at(row,'and/or').toUpperCase();
   const opening=row.filter((cell,i)=>!headers[i]&&/^\(+$/.test(cell)).join('');
   const closing=row.filter((cell,i)=>!headers[i]&&/^\)+$/.test(cell)).join('');
   return [connector,opening+rule+closing].filter(Boolean).join(' ');
 }).join('\n');
}
