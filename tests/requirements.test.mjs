import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRequirements} from '../static/requirements.mjs';
const lecture={id:'L1',linked:true,subject:'TEST',number:'100',kind:'Lecture'};
const lab={...lecture,id:'B1',kind:'Laboratory Skills/Techniques'};
const discussion={...lecture,id:'D1',kind:'Lecture-Supplem Act (Discuss)'};
const otherLab={...lab,id:'B2'};
const catalog=[lecture,lab,discussion,otherLab];
const check=(selected,data,extra={})=>checkRequirements(selected,catalog,{'L1':{data,...extra}})[0];
test('lecture alone identifies a missing discussion',()=>{
 const result=check([lecture],[[discussion]]);
 assert.equal(result.state,'missing');assert.match(result.message,/discussion/);
});
test('one compatible alternative satisfies the requirement',()=>{
 assert.equal(check([lecture,otherLab],[[lab],[otherLab]]).state,'complete');
});
test('a lab AND discussion in one combination are both required',()=>{
 assert.equal(check([lecture,lab],[[lab,discussion]]).state,'missing');
 assert.deepEqual(check([lecture,lab],[[lab,discussion]]).options[0].missing,[discussion]);
 assert.equal(check([lecture,lab,discussion],[[lab,discussion]]).state,'complete');
});
test('wrong lab with same course number cannot satisfy a specific pairing',()=>{
 assert.equal(check([lecture,otherLab],[[lab]]).state,'missing');
});
test('selecting a lab alone identifies its missing lecture',()=>{
 const result=checkRequirements([lab],catalog,{'B1':{data:[[lecture]]}})[0];
 assert.equal(result.state,'missing');assert.match(result.message,/lecture/);
});
test('removal immediately invalidates a previously complete combination',()=>{
 assert.equal(check([lecture,lab],[[lab]]).state,'complete');
 assert.equal(check([lecture],[[lab]]).state,'missing');
});
test('empty, failed, stale, or pending data never claims completeness',()=>{
 assert.equal(check([lecture],[]).state,'unknown');
 assert.equal(check([lecture,lab],[[lab]],{stale:true}).state,'unknown');
 assert.equal(check([lecture,lab],[[lab]],{error:'offline'}).state,'unknown');
 assert.equal(checkRequirements([lecture],catalog,{})[0].state,'checking');
 assert.equal(checkRequirements([lecture],[],{})[0].state,'unknown');
 assert.equal(checkRequirements([lecture],catalog,{},true)[0].state,'unknown');
});
test('unlinked course does not invent a lab requirement',()=>{
 const standalone={...lecture,linked:false};
 assert.equal(checkRequirements([standalone],[standalone],{})[0].state,'complete');
});
