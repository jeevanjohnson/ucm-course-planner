import {h} from './vendor/preact.mjs';
import {useState} from './vendor/hooks.mjs';
import htm from './vendor/htm.mjs';
import {researchEntry} from './research.mjs';
const html=htm.bind(h);
export function ResearchPanel({entries,onChange,enabled}){
 const [code,setCode]=useState(''),[units,setUnits]=useState(''),[error,setError]=useState('');
 function update(entry,patch){try{const next=researchEntry({...entry,...patch},entry.id);onChange(entries.map(r=>r.id===entry.id?next:r));setError('');}catch(e){setError(e.message);}}
 return html`<section class="info-panel research-panel" aria-label="Research credits"><div class="panel-heading"><h2>Research credits</h2></div><p class="panel-text">Plan credits before your research is finalized. Both tentative and confirmed credits count toward your planned units. Confirmation is your own record, not university enrollment.</p>
 <form class="research-form" onSubmit=${e=>{e.preventDefault();try{onChange([...entries,researchEntry({code,units})]);setCode('');setUnits('');setError('');}catch(err){setError(err.message);}}}><label>Research course<input placeholder="e.g. CSE 195" value=${code} required maxLength="30" onInput=${e=>setCode(e.target.value)}/></label><label>Research units<input type="number" min="0.01" max="30" step="any" required value=${units} onInput=${e=>setUnits(e.target.value)}/></label><button type="submit" disabled=${!enabled}>Add research credits</button></form>
 ${!enabled&&html`<p class="panel-text">Choose a semester first.</p>`}${error&&html`<p role="alert" class="warning-text">${error}</p>`}
 ${entries.map(r=>html`<div class="research-entry" key=${r.id}><label>Course code<input aria-label=${'Research course '+r.code} value=${r.code} onChange=${e=>update(r,{code:e.target.value})}/></label><label>Units<input aria-label=${'Units for '+r.code} type="number" min="0.01" max="30" step="any" value=${r.units} onInput=${e=>update(r,{units:e.target.value})}/></label><span class="badge">${r.confirmed?'Confirmed by you':'Tentative'}</span><button onClick=${()=>update(r,{confirmed:!r.confirmed})}>${r.confirmed?'Mark tentative':'Confirm credits'}</button><button aria-label=${'Remove research '+r.code} onClick=${()=>onChange(entries.filter(x=>x.id!==r.id))}>Remove</button></div>`)}
 <p class="panel-text">Research entries save with this plan. They have no scheduled meetings or seat monitoring. Avoid adding the same credits again as an official section.</p></section>`;
}
