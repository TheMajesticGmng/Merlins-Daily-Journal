import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDate,blankForDay,initialBlocks,projectedMinutes,loggedMinutes,clockAt,layoutValid,pieces,replaceSegment,switchSlot,markSlotSleep} from '../src/scheduleV2.ts';

test('calendar advances precisely at 4 AM local time',()=>{
 assert.equal(calendarDate(new Date(2026,9,23,3,59,59)),'2026-10-22');
 assert.equal(calendarDate(new Date(2026,9,23,4,0,0)),'2026-10-23');
});
test('4am timeline preserves three meals, 2AM and 6:30AM potty breaks and baseline 16h sleep',()=>{
 const blocks=initialBlocks();
 assert.ok(layoutValid(blocks));
 assert.equal(projectedMinutes(blocks),960);
 assert.equal(pieces(blocks,1320,15).filter(x=>x.block.category==='potty').reduce((n,p)=>n+p.duration,0),15);
 assert.equal(pieces(blocks,150,15).filter(x=>x.block.category==='potty').reduce((n,p)=>n+p.duration,0),15);
 assert.equal(blocks.filter(b=>b.category==='meal').length,3);
 assert.equal(clockAt(0),'4:00 AM');
 assert.equal(clockAt(1320),'2:00 AM');
 assert.equal(clockAt(150),'6:30 AM');
});
test('activity occupies exact fraction 10 minutes of 30 minute bubble',()=>{
 const start=900;
 const altered=replaceSegment(initialBlocks(),start,10,'potty','Potty');
 assert.ok(layoutValid(altered));
 const potty=pieces(altered,start).find(x=>x.block.start===start&&x.block.title==='Potty');
 assert.equal(potty.duration,10);
 assert.equal(potty.duration/30,1/3);
});
test('sleep tile toggle changes projected sleep and keeps partially mixed potty',()=>{
 const base=initialBlocks();
 const old=projectedMinutes(base);
 const mixed=switchSlot(base,1320);
 assert.ok(layoutValid(mixed));
 assert.equal(pieces(mixed,1320).find(x=>x.block.category==='potty')?.duration,15);
 assert.equal(projectedMinutes(mixed),old-15);
});
test('actual sleep is separate and can be marked per tile',()=>{
 const base=initialBlocks();const sleepSlot=210;
 const duration=pieces(base,sleepSlot).filter(x=>x.block.category==='sleep').reduce((n,x)=>n+x.duration,0);
 const modified=markSlotSleep(base,sleepSlot);
 assert.ok(layoutValid(modified));
 assert.equal(loggedMinutes(modified),duration);
 assert.equal(projectedMinutes(modified),projectedMinutes(base));
 assert.equal(loggedMinutes(markSlotSleep(modified,sleepSlot)),0);
});
test('new day uses clean copy of saved default without copying logs or actual sleep',()=>{
 const first=blankForDay();
 const edited=replaceSegment(first.blocks,180,10,'training','Place');
 const fresh=blankForDay(edited);
 assert.ok(layoutValid(fresh.blocks));
 assert.equal(fresh.logs.length,0);
 assert.equal(fresh.blocks.filter(b=>b.actualSleep!=null).length,0);
 assert.ok(fresh.blocks.some(b=>b.title==='Place'));
 assert.notEqual(fresh.blocks,edited);
});
