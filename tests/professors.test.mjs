import test from 'node:test';
import assert from 'node:assert/strict';
import {professorSearch,profileUrl,ratingRecord,ProfessorRepository} from '../static/professors.mjs';
test('review searches are UC Merced scoped and safely encode names',()=>{
 const url=new URL(professorSearch('Doe, Jane & Ann'));
 assert.equal(url.pathname,'/search/professors/4767');assert.equal(url.searchParams.get('q'),'Jane & Ann Doe');
});
test('only official HTTPS professor profiles are accepted',()=>{
 assert.equal(profileUrl('https://ratemyprofessors.com/professor/123?tracking=1'),'https://www.ratemyprofessors.com/professor/123');
 for(const url of ['javascript:alert(1)','https://ratemyprofessors.com.evil.test/professor/123','http://www.ratemyprofessors.com/professor/123','https://user@www.ratemyprofessors.com/professor/123'])assert.throws(()=>profileUrl(url));
});
test('manual ratings validate range, count and verification date',()=>{
 const input={url:'https://www.ratemyprofessors.com/professor/123',rating:'4.2',count:'12'};
 const record=ratingRecord(input,new Date('2026-10-12T12:00:00Z'));assert.equal(record.rating,4.2);assert.equal(record.count,12);assert.equal(record.checkedAt,'2026-10-12T12:00:00.000Z');
 for(const rating of ['0','5.1','abc','4.22'])assert.throws(()=>ratingRecord({...input,rating}));
 assert.throws(()=>ratingRecord({...input,count:'0'}));assert.throws(()=>ratingRecord({...input,count:'-1'}));
 assert.equal(ratingRecord({...input,rating:'',count:''}).rating,null);
});
test('ratings persist separately from schedule data',()=>{
 const store=new Map();store.getItem=store.get.bind(store);store.setItem=store.set.bind(store);
 store.set('ucm-planner.v1','existing plans');const repo=new ProfessorRepository(store);
 const records={'jane doe':ratingRecord({url:'https://www.ratemyprofessors.com/professor/123',rating:'4',count:'10'})};repo.save(records);
 assert.deepEqual(new ProfessorRepository(store).load(),records);assert.equal(store.get('ucm-planner.v1'),'existing plans');
 store.set(repo.key,'broken');assert.throws(()=>repo.load());assert.equal(store.get(repo.key),'broken');
});
