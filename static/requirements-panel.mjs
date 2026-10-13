import {h} from './vendor/preact.mjs';
import {useState,useEffect} from './vendor/hooks.mjs';
import htm from './vendor/htm.mjs';
import {DAYS,timeLabel,status,conflicts} from './domain.mjs';
import {checkRequirements,componentName} from './requirements.mjs';
const html=htm.bind(h);

export function RequirementsPanel({plan,catalog,meta,onAdd}){
 const [cache,setCache]=useState({}),[expanded,setExpanded]=useState(null),[limit,setLimit]=useState(6),[retry,setRetry]=useState(0);
 const identity=plan.mode+':'+plan.term;
 const catalogIds=new Map(catalog.map(c=>[c.id,c]));
 const linked=plan.courses.filter(c=>(catalogIds.get(c.id)||c).linked).map(c=>c.id).sort();
 const selection=linked.join(',');
 useEffect(()=>{
   let cancelled=false;
   async function load(){
     for(const id of linked){
       if(cancelled)return;
       const key=identity+':'+id,existing=cache[key];
       if(existing?.nextCheck>Date.now())continue;
       setCache(previous=>({...previous,[key]:{loading:true}}));
       try{
         const response=await fetch(`/api/linked?mode=${plan.mode}&term=${encodeURIComponent(plan.term)}&crn=${encodeURIComponent(id)}`);
         const result=await response.json();
         if(cancelled)return;
         if(!response.ok)throw Object.assign(Error(result.error||'Linked sections could not be checked. Restart the Python server if it has not been updated.'),{retryAfter:result.retryAfter});
         setCache(previous=>({...previous,[key]:{...result,nextCheck:Date.now()+Math.max(5,result.retryAfter??3600)*1000}}));
       }catch(error){
         if(cancelled)return;
         setCache(previous=>({...previous,[key]:{error:error.message,nextCheck:Date.now()+Math.max(60,error.retryAfter||60)*1000}}));
       }
     }
   }
   load();return()=>{cancelled=true;};
 },[identity,selection,meta?.fetchedAt,retry]);
 const records=Object.fromEntries(linked.map(id=>[id,cache[identity+':'+id]]));
 const checks=checkRequirements(plan.courses,catalog,records,meta?.stale||!meta);
 const missing=checks.filter(c=>c.state==='missing').length,unverified=checks.filter(c=>['unknown','checking'].includes(c.state)).length;
 function toggle(id){setExpanded(expanded===id?null:id);setLimit(6);}
 return html`<section class="info-panel requirements-panel" aria-label="Section requirements"><div class="panel-heading"><div><h2>Section requirements</h2><p>Lecture, lab, and discussion combinations from ${plan.mode==='demo'?'synthetic demo data':'official registration'}.</p></div><span class=${missing||unverified?'alert-count':'good-count'}>${!checks.length?'No courses yet':missing?`${missing} need attention`:unverified?'Not yet verified':'Linked sections complete'}</span></div>
 ${!checks.length&&html`<p class="panel-text">Add a lecture or another section to check its required companions.</p>`}
 ${checks.map(check=>html`<div class=${'requirement-item '+check.state} key=${check.course.id}><div class="requirement-heading"><strong>${check.course.subject} ${check.course.number} · ${check.course.id}</strong><span>${{complete:'✓',missing:'Missing section',unknown:'Not verified',checking:'Checking…'}[check.state]}</span></div><p>${check.message}</p>
 ${check.options&&check.state==='missing'&&html`<button onClick=${()=>toggle(check.course.id)}>${expanded===check.course.id?'Hide choices':`Choose required sections (${check.options.length})`}</button>`}
 ${check.state==='unknown'&&html`<button onClick=${()=>{const key=identity+':'+check.course.id;setCache(previous=>({...previous,[key]:undefined}));setRetry(n=>n+1);}}>Recheck requirements</button>`}
 ${expanded===check.course.id&&check.state==='missing'&&html`<div class="requirement-options">${check.options.slice(0,limit).map((option,index)=>{const additions=option.missing.map(c=>catalogIds.get(c.id)||c);const newIds=new Set(additions.map(c=>c.id));const collision=conflicts([...plan.courses,...additions]).some(c=>newIds.has(c.a.id)||newIds.has(c.b.id));return html`<div class="requirement-option"><strong>Option ${index+1} · ${option.missing.length} missing</strong>${option.sections.map(c=>{const current=catalogIds.get(c.id)||c;return html`<div><b>${componentName(c.kind)} · ${c.section} · CRN ${c.id}</b><span>${plan.courses.some(s=>s.id===c.id)?'Already in plan':status(current.availability)}</span>${c.meetings.map(m=>html`<small>${m.days.map(d=>DAYS[d]).join(', ')||'Arranged'} · ${timeLabel(m.start)}–${timeLabel(m.end)} · ${m.location}</small>`)}</div>`;})}${collision&&html`<p class="conflict-note">This option introduces a time conflict.</p>`}<button onClick=${()=>onAdd(additions)}>${`Add ${option.missing.length} missing section${option.missing.length===1?'':'s'}`}</button></div>`;})}${check.options.length>limit&&html`<button onClick=${()=>setLimit(n=>n+6)}>Show more combinations</button>`}</div>`}
 </div>`)}
 <p class="panel-text">This checks linked sections only. Prerequisites, enrollment restrictions, and separate course corequisites still need official registration checks.</p></section>`;
}
