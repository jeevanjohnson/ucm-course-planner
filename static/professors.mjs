/** Links use RMP's public UC Merced search. Ratings are user-entered snapshots. */
export function professorKey(name){return name.trim().replace(/\s+/g,' ').toLocaleLowerCase();}
export function professorSearch(name){
 const parts=name.split(',').map(s=>s.trim());
 const query=parts.length===2?`${parts[1]} ${parts[0]}`:name.trim();
 return `https://www.ratemyprofessors.com/search/professors/4767?q=${encodeURIComponent(query)}`;
}
export function profileUrl(value){
 if(!value.trim())return '';
 let url;try{url=new URL(value);}catch{throw Error('Enter a valid Rate My Professors profile URL.');}
 if(url.protocol!=='https:'||!['www.ratemyprofessors.com','ratemyprofessors.com'].includes(url.hostname)||url.username||url.password||url.port||!/^\/professor\/\d+\/?$/.test(url.pathname))throw Error('Use an https://www.ratemyprofessors.com/professor/… profile link.');
 return 'https://www.ratemyprofessors.com'+url.pathname.replace(/\/$/,'');
}
export function ratingRecord({url,rating,count},now=new Date()){
 const profile=profileUrl(url);
 if(!profile)throw Error('Paste the professor’s profile link so the saved rating has a source.');
 const value=rating.trim()===''?null:Number(rating);
 if(value!==null&&(!Number.isFinite(value)||value<1||value>5||Math.abs(value*10-Math.round(value*10))>1e-8))throw Error('Enter an overall rating from 1.0 to 5.0, or leave it blank.');
 const reviews=count.trim()===''?null:Number(count);
 if(reviews!==null&&(!Number.isInteger(reviews)||reviews<0))throw Error('Review count must be a nonnegative whole number.');
 if(value!==null&&reviews===0)throw Error('A professor with zero reviews has no numeric rating.');
 return {url:profile,rating:value,count:reviews,checkedAt:now.toISOString()};
}
export class ProfessorRepository{
 constructor(storage=globalThis.localStorage){this.storage=storage;this.key='ucm-professor-ratings.v1';}
 load(){const raw=this.storage.getItem(this.key);if(!raw)return {};const data=JSON.parse(raw);if(!data||data.version!==1||!data.records||typeof data.records!=='object'||Array.isArray(data.records))throw Error('Saved professor ratings could not be read. Existing data was preserved.');
 for(const record of Object.values(data.records)){if(!record||typeof record.url!=='string'||!profileUrl(record.url)||!Number.isFinite(Date.parse(record.checkedAt))||record.rating!==null&&(!Number.isFinite(record.rating)||record.rating<1||record.rating>5))throw Error('Saved professor ratings could not be read. Existing data was preserved.');}
 return data.records;
 }
 save(records){this.storage.setItem(this.key,JSON.stringify({version:1,records}));}
}
