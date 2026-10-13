import test from 'node:test';
import assert from 'node:assert/strict';
import {overlap,conflicts,eventsForWeek,notifications,exportICS,snapshot,ScheduleRepository,initialState,newPlan} from '../static/domain.mjs';
const meeting={days:[0,2],start:600,end:660,startDate:'2027-01-18',endDate:'2027-05-07',location:'Library, 1',type:'Lecture'};
const course={id:'1',subject:'TEST',number:'101',title:'Test',instructors:[],meetings:[meeting],availability:{seats:3}};
test('overlap: multiple days, adjacent classes and date boundaries',()=>{
 assert.deepEqual(overlap(meeting,{...meeting,days:[2,4],start:630,end:700}).days,[2]);
 assert.equal(overlap(meeting,{...meeting,start:660,end:720}),null);
 assert.equal(overlap(meeting,{...meeting,startDate:'2027-05-08',endDate:'2027-05-09'}),null);
 assert.equal(overlap(meeting,{...meeting,startDate:'2027-01-19',endDate:'2027-01-19'}),null);
 assert.equal(overlap(meeting,{...meeting,start:null}),null);
});
test('lectures, labs and exams use their own date ranges',()=>{
 const exam={...meeting,days:[0],startDate:'2027-05-10',endDate:'2027-05-10'};
 assert.equal(conflicts([course,{...course,id:'2',meetings:[exam]}]).length,0);
 assert.equal(eventsForWeek([{...course,meetings:[meeting,exam]}],'2027-01-18').length,2);
 assert.equal(eventsForWeek([{...course,meetings:[meeting,exam]}],'2027-05-10').length,1);
});
test('availability is never saved with selections; notifications only on transitions',()=>{
 assert.equal(snapshot(course).availability,undefined);
 assert.equal(notifications({'1':{seats:0}},{'1':{seats:2}},[course]).length,1);
 assert.equal(notifications({'1':{seats:2}},{'1':{seats:0}},[course]).length,1);
 assert.equal(notifications({}, {'1':{seats:2}}, [course]).length,0);
 assert.equal(notifications({'1':{seats:2}},{'1':{seats:null}},[course]).length,0);
});
test('independent plans, reset undo data, colors and order survive storage roundtrip',()=>{
 const storage=new Map();storage.getItem=storage.get.bind(storage);storage.setItem=storage.set.bind(storage);
 const repo=new ScheduleRepository(storage),s=initialState();s.plans[0].courses=[snapshot(course)];s.plans[0].undo=[snapshot(course)];
 const alternative=newPlan('B','demo','demo');s.plans.push(alternative);s.active=alternative.id;repo.save(s);
 assert.deepEqual(new ScheduleRepository(storage).load(),s);
 assert.equal(repo.load().plans[1].courses.length,0);
 storage.setItem(repo.key,'broken');assert.throws(()=>repo.load());assert.equal(storage.getItem(repo.key),'broken');
});
test('ICS export includes Pacific timezone, exact recurrence and skips arranged meetings',()=>{
 const p={id:'p',mode:'live',courses:[course,{...course,id:'2',meetings:[{...meeting,days:[],start:null}]}]};
 const x=exportICS(p);assert.equal(x.count,1);assert.equal(x.skipped,1);
 assert.match(x.text,/TZID:America\/Los_Angeles/);assert.match(x.text,/BYDAY=MO,WE;COUNT=32/);assert.match(x.text,/LOCATION:Library\\, 1/);
 assert.ok(x.text.endsWith('\r\n'));assert.ok(x.text.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75));
});
