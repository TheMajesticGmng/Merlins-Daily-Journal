import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplate, sleepMinutes } from '../src/model.ts';
import { partsInHalfHour, tileSleepMinutes, wakeHalfHour, sleepHalfHour, replaceInterval } from '../src/halfHour.ts';

const total=(blocks)=>blocks.reduce((sum,b)=>sum+b.duration,0);
const valid=(blocks)=>{
  const sorted=[...blocks].sort((a,b)=>a.start-b.start);
  assert.equal(sorted[0].start,0);
  for(let i=1;i<sorted.length;i++) assert.equal(sorted[i].start,sorted[i-1].start+sorted[i-1].duration,'blocks cannot overlap or leave holes');
  assert.equal(sorted.at(-1).start+sorted.at(-1).duration,1440);
  assert.equal(total(sorted),1440);
};

test('both schedules fill exactly 48 half-hour tiles across 24 hours',()=>{
  for(const name of ['original','restful']){
    const blocks=buildTemplate(name);
    valid(blocks);
    const parts=Array.from({length:48},(_,i)=>partsInHalfHour(blocks,i*30));
    assert.equal(parts.length,48);
    for(const tile of parts) assert.equal(tile.reduce((sum,p)=>sum+p.minutes,0),30);
    assert.equal(parts.flat().reduce((sum,p)=>sum+p.minutes,0),1440);
  }
});
test('preserves exact 16h original and 18h restful projected sleep',()=>{
  assert.equal(sleepMinutes(buildTemplate('original')),960);
  assert.equal(sleepMinutes(buildTemplate('restful')),1080);
});
test('10 minute potty activity fills precisely one third of its tile',()=>{
  const parts=partsInHalfHour(buildTemplate('original'),0);
  assert.deepEqual(parts.map(p=>p.minutes),[10,10,10]);
  assert.equal(parts[0].block.category,'potty');
  assert.equal(parts[0].minutes/30,1/3);
});
test('overnight 2AM and 6:30AM potty outings remain 15 minutes and subtract from planned sleep',()=>{
  const blocks=buildTemplate('original');
  for(const minute of [1140,1410]){
    const parts=partsInHalfHour(blocks,minute);
    assert.equal(parts.find(p=>p.block.category==='potty')?.minutes,15);
    assert.equal(tileSleepMinutes(blocks,minute),15);
  }
});
test('toggling a mixed nighttime tile awake preserves the essential potty block',()=>{
  const before=buildTemplate('original');
  const after=wakeHalfHour(before,1140);
  valid(after);
  assert.equal(tileSleepMinutes(after,1140),0);
  assert.equal(partsInHalfHour(after,1140).find(p=>p.block.category==='potty')?.minutes,15);
  assert.equal(sleepMinutes(after),sleepMinutes(before)-15);
});
test('toggling an awake tile into sleep increases projected sleep by 30 minutes',()=>{
  const before=buildTemplate('original');
  const after=sleepHalfHour(before,0);
  valid(after);
  assert.equal(tileSleepMinutes(after,0),30);
  assert.equal(sleepMinutes(after),sleepMinutes(before)+30);
});
test('creating a 10-minute activity changes only that portion of a half hour',()=>{
  const before=buildTemplate('original');
  const after=replaceInterval(before,20,10,'training','Place training');
  valid(after);
  const pieces=partsInHalfHour(after,0);
  assert.equal(pieces.reduce((sum,p)=>sum+p.minutes,0),30);
  assert.equal(pieces.at(-1).minutes,10);
  assert.equal(pieces.at(-1).block.title,'Place training');
  assert.equal(sleepMinutes(before),sleepMinutes(after));
});
