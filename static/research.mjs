export function researchEntry(input,id=crypto.randomUUID()){
 const code=String(input.code||'').trim().toUpperCase().replace(/\s+/g,' ');
 const units=Number(input.units);
 if(!/^[A-Z][A-Z &-]{0,19} \d{1,4}[A-Z]?$/.test(code))throw Error('Enter a course code such as CSE 195.');
 if(input.units===''||!Number.isFinite(units)||units<=0||units>30)throw Error('Enter units greater than 0 and no more than 30.');
 return {id,code,units,confirmed:input.confirmed===true};
}
export const researchUnits=plan=>(plan.research||[]).reduce((sum,r)=>sum+r.units,0);
