import test from 'node:test';
import assert from 'node:assert/strict';
import {requirementText} from '../static/prerequisites.mjs';
import {researchEntry,researchUnits} from '../static/research.mjs';
import {ScheduleRepository,initialState} from '../static/domain.mjs';
test('prerequisite text retains alternatives, groups and minimum grades',()=>{
 const text=requirementText({headers:['And/Or','','Test','Score','Subject','Course Number','Level','Grade',''],rows:[['','','','','Cognitive Science','001','Undergraduate','C-',''],['And','(','','','Cognitive Science','101','Undergraduate','C-',''],['Or','','','','Cognitive Science','102','Undergraduate','C-',')']]});
 assert.equal(text,'Cognitive Science 001 (minimum grade C-)\nAND (Cognitive Science 101 (minimum grade C-)\nOR Cognitive Science 102 (minimum grade C-))');
});
test('other rule tables retain labeled information',()=>assert.equal(requirementText({headers:['Requirement','Value'],rows:[['Permission','Instructor']]}),'Requirement: Permission · Value: Instructor'));
test('research credits persist independently and confirmation does not change total',()=>{
 const entry=researchEntry({code:'cse 195',units:'4'},'research-1');
 const s=initialState();s.plans[0].research=[entry];
 const storage={getItem:()=>storage.value,setItem:(key,value)=>storage.value=value};const repo=new ScheduleRepository(storage);repo.save(s);
 const restored=repo.load();assert.equal(researchUnits(restored.plans[0]),4);assert.equal(restored.plans[0].research[0].confirmed,false);
 restored.plans[0].research[0]=researchEntry({...entry,confirmed:true},entry.id);assert.equal(researchUnits(restored.plans[0]),4);assert.equal(restored.plans[0].courses.length,0);
 assert.equal(researchUnits({}),0);
});
test('invalid research units and course codes are rejected',()=>{
 for(const units of ['',0,-1,'bad',Infinity,31])assert.throws(()=>researchEntry({code:'CSE 195',units},'id'));
 assert.throws(()=>researchEntry({code:'',units:4},'id'));
 assert.equal(researchEntry({code:'CSE 195',units:1.5},'id').units,1.5);
});
