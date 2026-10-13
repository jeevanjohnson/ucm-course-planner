/** Official combinations are OR alternatives; sections within each are AND requirements. */
export function checkRequirements(selected, catalog, records, catalogStale=false) {
  const ids=new Set(selected.map(c=>c.id));
  const current=new Map(catalog.map(c=>[c.id,c]));
  return selected.map(saved=>{
    const course=current.get(saved.id)||saved, record=records[course.id];
    if(!current.has(saved.id)||catalogStale)return {course,state:'unknown',message:'Current section information is unavailable. Requirements are not verified.'};
    if(!course.linked)return {course,state:'complete',message:'No linked lab or discussion listed by the university.'};
    if(!record||record.loading)return {course,state:'checking',message:'Checking official linked-section combinations…'};
    if(record.stale||record.error)return {course,state:'unknown',message:record.error||'Linked-section information is stale. Requirements are not verified.'};
    if(!Array.isArray(record.data)||!record.data.length)return {course,state:'unknown',message:'No combinations returned for this linked section. Verify in official registration.'};
    const options=record.data.map(sections=>({sections,missing:sections.filter(c=>!ids.has(c.id))})).sort((a,b)=>a.missing.length-b.missing.length);
    if(options.some(o=>!o.missing.length))return {course,state:'complete',message:'A complete official linked-section combination is in your plan.',options};
    const kinds=[...new Set(options[0].missing.map(c=>componentName(c.kind)))];
    return {course,state:'missing',message:`Missing ${kinds.join(' + ')}. Choose one compatible combination below.`,options};
  });
}
export function componentName(kind=''){
  if(/discuss/i.test(kind))return 'discussion';
  if(/lab/i.test(kind))return 'lab';
  if(/lecture/i.test(kind))return 'lecture';
  return kind.toLowerCase()||'required section';
}
