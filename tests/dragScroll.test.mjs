import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeScrollSpeed } from '../src/dragScroll.ts';
import { initialBlocks, layoutValid, replaceSegment, projectedMinutes, pieces } from '../src/scheduleV2.ts';

test('dragging near the bottom scrolls down and near top scrolls up',()=>{
 assert.equal(edgeScrollSpeed(350,700),0);
 assert.ok(edgeScrollSpeed(690,700)>0);
 assert.ok(edgeScrollSpeed(10,700)<0);
 assert.ok(edgeScrollSpeed(695,700)>edgeScrollSpeed(620,700));
 assert.ok(Math.abs(edgeScrollSpeed(5,700))>Math.abs(edgeScrollSpeed(100,700)));
});
test('short screens and shifted mobile viewport are supported',()=>{
 assert.equal(edgeScrollSpeed(300,500,50),0);
 assert.ok(edgeScrollSpeed(545,500,50)>0);
 assert.ok(edgeScrollSpeed(52,500,50)<0);
 assert.equal(edgeScrollSpeed(100,0),0);
});
test('sleep sticker fits in remainder after a 10-minute nighttime potty trip',()=>{
 let blocks=initialBlocks();
 // Make a 30-minute awake interval at 2 AM, then fill with 10 minutes potty and 20 sleep.
 const original=projectedMinutes(blocks);
 blocks=replaceSegment(blocks,1320,30,'other','Up briefly');
 const afterWake=projectedMinutes(blocks);
 blocks=replaceSegment(blocks,1320,10,'potty','Potty');
 blocks=replaceSegment(blocks,1330,20,'sleep','Sleep');
 assert.ok(layoutValid(blocks));
 assert.equal(pieces(blocks,1320).find(x=>x.block.category==='potty')?.duration,10);
 assert.equal(pieces(blocks,1320).find(x=>x.block.category==='sleep')?.duration,20);
 assert.equal(projectedMinutes(blocks),afterWake+20);
 assert.equal(projectedMinutes(blocks),original+5);
});
