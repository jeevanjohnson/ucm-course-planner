import {h} from './vendor/preact.mjs';
import {useState,useEffect} from './vendor/hooks.mjs';
import htm from './vendor/htm.mjs';
import {requirementText} from './prerequisites.mjs';
const html=htm.bind(h);
export function CourseDetails({course,mode}){
 const [result,setResult]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;const controller=new AbortController();setResult(null);setError('');setLoading(true);
   fetch(`/api/details?mode=${mode}&term=${encodeURIComponent(course.term)}&crn=${encodeURIComponent(course.id)}`,{signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Official course details are unavailable.');return data;})
   .then(data=>{if(active){setResult(data);if(data.error)setError(data.error);}})
   .catch(err=>{if(active)setError(err.message||'Official course details could not be loaded.');})
   .finally(()=>{if(active)setLoading(false);});
   return()=>{active=false;controller.abort();};
 },[course.term,course.id,mode,attempt]);
 return html`<section class="course-information" aria-label="Course description and requirements"><div class="detail-source"><strong>${mode==='demo'?'Synthetic demo information':'Official section information'}</strong>${mode!=='demo'&&html`<a href="https://catalog.ucmerced.edu/" target="_blank" rel="noopener noreferrer">UC Merced catalog ↗</a>`}</div>
 ${loading&&html`<p role="status">Loading description and requirements…</p>`}
 ${error&&html`<div class="banner warning" role="alert">${error} ${result?'Showing the last successful snapshot.':''}<button onClick=${()=>setAttempt(n=>n+1)}>Retry details</button></div>`}
 ${result?.data.map(item=>html`<div class="course-information-block"><h3>${item.label}</h3><p class="official-detail-text">${item.text}</p>${item.tables.map(table=>html`<p class="requirement-text">${requirementText(table)}</p>`)}${item.sourceUrl&&html`<a class="detail-source-link" href=${item.sourceUrl} target="_blank" rel="noopener noreferrer">View official source ↗</a>`}</div>`)}
 ${result&&html`<small class="detail-updated">${result.stale?'Stale snapshot · ':''}Retrieved ${new Date(result.fetchedAt).toLocaleString()} · Term ${course.term}</small>`}
 <p class="detail-caveat">Prerequisite alternatives, AND/OR rules, parentheses, and minimum grades are shown as supplied by the university. “No information available” does not confirm eligibility. Check the catalog for your academic year and official registration for placement, permissions, and restrictions.</p></section>`;
}
