import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTemplate,sleepMinutes,toClock,inputToOffset} from '../src/model.ts';
for(const [name,expected] of [['original',960],['restful',1080]]){
 test(`${name} total sleep ${expected} min`,()=>{assert.equal(sleepMinutes(buildTemplate(name)),expected)});
 test(`${name} timeline covers 24h without gaps or overlaps`,()=>{const blocks=buildTemplate(name);let position=0;for(const b of blocks){assert.equal(b.start,position,`problem around ${toClock(position)}: ${b.title}`);position+=b.duration}assert.equal(position,1440)});
 test(`${name} includes essential scheduled events`,()=>{const b=buildTemplate(name);for(const start of [420,780,1140,1410])assert.ok(b.some(x=>x.start===start&&x.category==='potty'),`missing potty at ${toClock(start)}`);assert.equal(b.filter(x=>x.category==='meal').length,3)});
}
test('time conversion handles next morning',()=>{assert.equal(toClock(1140),'2:00 AM');assert.equal(inputToOffset('02:00'),1140);assert.equal(toClock(1410),'6:30 AM')});
