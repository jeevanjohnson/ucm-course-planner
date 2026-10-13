export const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const COLORS=['#136d78','#8561b0','#c37a22','#347abd','#b3506c','#527a40','#975b36'];
export const clone=x=>JSON.parse(JSON.stringify(x));
export const uid=()=>crypto.randomUUID();
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function dateAdd(s,n){const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekday(s){return (new Date(s+'T00:00:00Z').getUTCDay()+6)%7;}
export const monday=s=>dateAdd(s,-weekday(s));
export function timeLabel(n){if(n==null)return 'TBA';const h=Math.floor(n/60);return `${h%12||12}:${String(n%60).padStart(2,'0')} ${h<12?'AM':'PM'}`;}
export function status(a){if(a?.seats==null)return 'Unknown';return a.seats<=0?'Full':a.seats<=5?'Nearly Full':'Open';}
export function snapshot(course){const {availability,...rest}=course;return clone(rest);}
export function newPlan(name='My schedule',mode='live',term=''){return {id:uid(),name,mode,term,courses:[],undo:null,week:''};}
export function initialState(){const p=newPlan();return {version:1,active:p.id,plans:[p],interval:600};}
export class ScheduleRepository {
  constructor(storage=globalThis.localStorage){this.storage=storage;this.key='ucm-planner.v1';}
  load(){const raw=this.storage.getItem(this.key);if(!raw)return initialState();let s;try{s=JSON.parse(raw);}catch{throw Error('Saved plan format is unreadable. Existing storage has been preserved.');}const validCourse=c=>c&&typeof c.id==='string'&&Array.isArray(c.meetings)&&Array.isArray(c.instructors)&&c.meetings.every(m=>Array.isArray(m.days));if(s?.version!==1||!Array.isArray(s.plans)||!s.plans.length||!s.plans.every(p=>p.id&&typeof p.name==='string'&&['live','demo'].includes(p.mode)&&typeof p.term==='string'&&Array.isArray(p.courses)&&p.courses.every(validCourse)&&(!p.undo||Array.isArray(p.undo)&&p.undo.every(validCourse)))||!s.plans.some(p=>p.id===s.active))throw Error('Saved plan format is unreadable. Existing storage has been preserved.');return s;}
  save(s){this.storage.setItem(this.key,JSON.stringify(s));}
}
export function overlap(a,b){
  if(a.start==null||b.start==null||a.end==null||b.end==null)return null;
  const start=Math.max(a.start,b.start),end=Math.min(a.end,b.end);
  if(start>=end)return null;
  const low=[a.startDate,b.startDate].filter(Boolean).sort().at(-1);
  const high=[a.endDate,b.endDate].filter(Boolean).sort()[0];
  if(low&&high&&low>high)return null;
  const days=a.days.filter(d=>b.days.includes(d)&&(!low||!high||dateAdd(low,(d-weekday(low)+7)%7)<=high));
  return days.length?{days,start,end,from:low,to:high}:null;
}
export function conflicts(courses){const found=[];for(let i=0;i<courses.length;i++)for(let j=i+1;j<courses.length;j++)for(const a of courses[i].meetings)for(const b of courses[j].meetings){const o=overlap(a,b);if(o)found.push({...o,a:courses[i],b:courses[j]});}return found;}
export function eventsForWeek(courses,week){const events=[];for(const c of courses)for(const [mi,m] of c.meetings.entries())for(const day of m.days){const date=dateAdd(week,day);if(m.start!=null&&m.end!=null&&(!m.startDate||date>=m.startDate)&&(!m.endDate||date<=m.endDate))events.push({course:c,m,mi,day,date});}return events;}
export function notifications(before,after,selected){const messages=[];for(const c of selected){const a=before[c.id]?.seats,b=after[c.id]?.seats;if(a==null||b==null)continue;if(a>0&&b<=0)messages.push(`${c.subject} ${c.number} · ${c.id} is now full.`);if(a<=0&&b>0)messages.push(`${c.subject} ${c.number} · ${c.id} now has ${b} seat${b===1?'':'s'} available.`);}return messages;}
const escapeICS=s=>String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function fold(line){let out='',part='',size=0;for(const char of line){const bytes=new TextEncoder().encode(char).length;if(size+bytes>73){out+=part+'\r\n ';part='';size=1;}part+=char;size+=bytes;}return out+part;}
export function exportICS(plan){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Local UCM Planner//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
  'BEGIN:VTIMEZONE','TZID:America/Los_Angeles','BEGIN:DAYLIGHT','DTSTART:19700308T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU','TZOFFSETFROM:-0800','TZOFFSETTO:-0700','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19701101T020000','RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU','TZOFFSETFROM:-0700','TZOFFSETTO:-0800','END:STANDARD','END:VTIMEZONE'];
  let skipped=0,count=0;
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z');
  for(const c of plan.courses)for(const [mi,m] of c.meetings.entries()){
    if(!m.days.length||m.start==null||m.end==null||!m.startDate||!m.endDate){skipped++;continue;}
    const first=m.days.map(day=>dateAdd(m.startDate,(day-weekday(m.startDate)+7)%7)).sort()[0];
    if(first>m.endDate)continue;
    const dt=n=>first.replaceAll('-','')+'T'+String(Math.floor(n/60)).padStart(2,'0')+String(n%60).padStart(2,'0')+'00';
    const dates=m.days.map(day=>{let n=0;for(let d=dateAdd(m.startDate,(day-weekday(m.startDate)+7)%7);d<=m.endDate;d=dateAdd(d,7))n++;return n;}).reduce((a,b)=>a+b,0);
    lines.push('BEGIN:VEVENT',`UID:${plan.id}-${c.id}-${mi}@local-ucm-planner`,`DTSTAMP:${stamp}`,`DTSTART;TZID=America/Los_Angeles:${dt(m.start)}`,`DTEND;TZID=America/Los_Angeles:${dt(m.end)}`,`RRULE:FREQ=WEEKLY;BYDAY=${m.days.map(d=>['MO','TU','WE','TH','FR','SA','SU'][d]).join(',')};COUNT=${dates}`,`SUMMARY:${escapeICS((plan.mode==='demo'?'DEMO · ':'')+c.subject+' '+c.number+' — '+c.title)}`,`LOCATION:${escapeICS(m.location)}`,`DESCRIPTION:${escapeICS('Planning only; not enrolled. CRN '+c.id+'. '+m.type+'. Holidays are not excluded.')}`,'END:VEVENT');count++;
  }
  lines.push('END:VCALENDAR');return {text:lines.map(fold).join('\r\n')+'\r\n',skipped,count};
}
