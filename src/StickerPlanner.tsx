import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { RotateCcw, Save, Undo2 } from 'lucide-react';
import { type Block, type Category, type JournalEvent, makeId, categoryEmoji } from './model';
import { clockAt, clockCompact, clamp, snap5, pieces, switchSlot, replaceSegment, markSlotSleep, projectedMinutes, loggedMinutes, offsetForClock } from './scheduleV2';

type ActivityTool={id:string;type:'activity';category:Category;duration:number;label:string;emoji:string};
type LogTool={id:string;type:'log';kind:JournalEvent['kind'];result?:JournalEvent['result'];mood?:string;label:string;emoji:string};
type Tool=ActivityTool|LogTool;

const ACTIVITY_TOOLS:ActivityTool[]=[
 {id:'potty',type:'activity',category:'potty',duration:10,label:'Potty',emoji:'🐾'},
 {id:'breakfast',type:'activity',category:'meal',duration:15,label:'Breakfast',emoji:'🥣'},
 {id:'lunch',type:'activity',category:'meal',duration:15,label:'Lunch',emoji:'🥪'},
 {id:'dinner',type:'activity',category:'meal',duration:15,label:'Dinner',emoji:'🍽️'},
 {id:'walk',type:'activity',category:'walk',duration:15,label:'Sniff walk',emoji:'🌿'},
 {id:'training',type:'activity',category:'training',duration:10,label:'Training',emoji:'✨'},
 {id:'play',type:'activity',category:'play',duration:10,label:'Light play',emoji:'🎾'},
 {id:'enrichment',type:'activity',category:'enrichment',duration:10,label:'Enrichment',emoji:'🧩'},
 {id:'settle',type:'activity',category:'settle',duration:10,label:'Wind down',emoji:'☁️'},
 {id:'social',type:'activity',category:'social',duration:10,label:'Socialization',emoji:'🌟'},
 {id:'grooming',type:'activity',category:'grooming',duration:10,label:'Grooming',emoji:'🪮'},
 {id:'cuddle',type:'activity',category:'cuddle',duration:10,label:'Cuddles',emoji:'💛'}
];
const LOG_TOOLS:LogTool[]=[
 {id:'pee',type:'log',kind:'potty',result:'pee',label:'#1',emoji:'💧'},
 {id:'poop',type:'log',kind:'potty',result:'poop',label:'#2',emoji:'💩'},
 {id:'both',type:'log',kind:'potty',result:'both',label:'Both',emoji:'🐾'},
 {id:'none',type:'log',kind:'potty',result:'neither',label:'Neither',emoji:'➖'},
 {id:'meal-done',type:'log',kind:'meal',label:'Ate',emoji:'🥣'},
 {id:'accident',type:'log',kind:'accident',result:'pee',label:'Accident',emoji:'⚠️'},
 {id:'calm',type:'log',kind:'behavior',mood:'calm',label:'Calm',emoji:'🌙'},
 {id:'frantic',type:'log',kind:'behavior',mood:'frantic',label:'Frantic',emoji:'⚡'},
 {id:'training-done',type:'log',kind:'training',label:'Practiced',emoji:'🏅'},
 {id:'crate',type:'log',kind:'crate',label:'Crate',emoji:'🏠'},
 {id:'water',type:'log',kind:'water',label:'Water',emoji:'💦'},
 {id:'med',type:'log',kind:'medication',label:'Medicine',emoji:'💊'}
];
const LABEL_FOR_KIND:Record<string,string>={potty:'🐾',meal:'🥣',accident:'⚠️',behavior:'🌙',training:'🏅',crate:'🏠',water:'💦',medication:'💊',weight:'⚖️',grooming:'🪮',social:'🌟',other:'⭐'};
function logSticker(log:JournalEvent):string {
 if(log.kind==='potty')return ({pee:'💧',poop:'💩',both:'🐾',neither:'➖'} as Record<string,string>)[log.result||'neither'];
 if(log.kind==='behavior')return log.mood==='frantic'?'⚡':'🌙';
 return LABEL_FOR_KIND[log.kind]||'⭐';
}
type DragMode='palette'|'move'|'left'|'right';
type DragSession={mode:DragMode;pointerId:number;tool?:Tool;block?:Block;x:number;y:number;fromX:number;fromY:number;holding:boolean;active:boolean;timer?:ReturnType<typeof setTimeout>;previewStart?:number;previewLength?:number};
type DragVisual={x:number;y:number;label:string;duration?:number;slot?:number}|null;
const HOUR_COUNT=24;
const minutesLabel=(n:number)=>n>=60?`${Math.floor(n/60)}h ${String(n%60).padStart(2,'0')}m`:`${n} min`;
const displayDuration=(m:number)=>`${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;

type Props={
 blocks:Block[];logs:JournalEvent[];readOnly?:boolean;
 onBlocksChange:(blocks:Block[])=>void;onLogsChange:(logs:JournalEvent[])=>void;
 onSaveDefault:()=>void;onResetFromDefault:()=>void;
};
export default function StickerPlanner({blocks,logs,readOnly=false,onBlocksChange,onLogsChange,onSaveDefault,onResetFromDefault}:Props){
 const [selected,setSelected]=useState<Tool|null>(null);
 const [visual,setVisual]=useState<DragVisual>(null);
 const [undo,setUndo]=useState<{blocks:Block[];logs:JournalEvent[]}|null>(null);
 const session=useRef<DragSession|null>(null);
 const blocksRef=useRef(blocks),logsRef=useRef(logs);
 blocksRef.current=blocks;logsRef.current=logs;
 const planned=projectedMinutes(blocks),logged=loggedMinutes(blocks);

 const makeChange=(nextBlocks?:Block[],nextLogs?:JournalEvent[])=>{
  setUndo({blocks:blocksRef.current,logs:logsRef.current});
  if(nextBlocks)onBlocksChange(nextBlocks);
  if(nextLogs)onLogsChange(nextLogs);
 };
 const tileHit=(x:number,y:number):{slot:number;point:number}|null=>{
  const elem=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-calendar-tile]');
  if(!elem)return null;
  const slot=Number(elem.dataset.calendarTile);
  const rect=elem.getBoundingClientRect();
  // Five-minute precision inside a 30-minute bubble.
  const point=clamp(snap5(slot+((x-rect.left)/rect.width)*30),slot,slot+30);
  return {slot,point};
 };
 const placeTool=(tool:Tool,slot:number,point:number)=>{
  if(readOnly)return;
  if(tool.type==='log'){
   const minute=clamp(point,slot,slot+25);
   const total=(4*60+minute)%1440;
   const time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
   let meal:JournalEvent['meal'];
   if(tool.kind==='meal'){
    const scheduled=pieces(blocksRef.current,minute,1).find(x=>x.block.category==='meal')?.block.title.toLowerCase()||'';
    meal=scheduled.includes('breakfast')?'Breakfast':scheduled.includes('lunch')?'Lunch':scheduled.includes('dinner')?'Dinner':'Snack';
   }
   const log:JournalEvent={id:makeId(),kind:tool.kind,time,note:'',result:tool.result,mood:tool.mood,place:tool.kind==='accident'?'inside':tool.kind==='potty'?'outside':undefined,meal};
   makeChange(undefined,[...logsRef.current,log]);return;
  }
  const start=clamp(snap5(point),0,1440-tool.duration);
  makeChange(replaceSegment(blocksRef.current,start,tool.duration,tool.category,tool.label),undefined);
 };
 const moveBlock=(block:Block,start:number)=>{
  const dest=clamp(snap5(start),0,1440-block.duration);
  const remainder=blocksRef.current.filter(b=>b.id!==block.id);
  // Free old location before inserting new activity; preserve every other interval.
  const emptied=replaceSegment(remainder,block.start,block.duration,'other','Open time');
  makeChange(replaceSegment(emptied,dest,block.duration,block.category,block.title),undefined);
 };
 const resizeBlock=(block:Block,start:number,duration:number)=>{
  const bounded=clamp(snap5(start),0,1435);
  const boundedDuration=clamp(snap5(duration),5,1440-bounded);
  const others=blocksRef.current.filter(b=>b.id!==block.id);
  const freed=replaceSegment(others,block.start,block.duration,'other','Open time');
  makeChange(replaceSegment(freed,bounded,boundedDuration,block.category,block.title),undefined);
 };
 const toggleTile=(slot:number)=>{
  if(readOnly)return;
  const items=pieces(blocksRef.current,slot);
  const isAwake=!items.some(p=>p.block.category==='sleep');
  if(isAwake && items.some(p=>p.block.category!=='other') && !window.confirm('Make this half-hour sleep? This will replace any planned activities inside it.'))return;
  makeChange(switchSlot(blocksRef.current,slot),undefined);
 };
 const markSleep=(slot:number)=>{if(!readOnly)makeChange(markSlotSleep(blocksRef.current,slot),undefined)};
 const finishSession=(e:PointerEvent)=>{
  const d=session.current;
  if(!d||e.pointerId!==d.pointerId)return;
  if(d.timer)clearTimeout(d.timer);
  const hit=tileHit(e.clientX,e.clientY);
  if(d.active&&hit&&!readOnly){
   if(d.mode==='palette'&&d.tool)placeTool(d.tool,hit.slot,hit.point);
   if(d.mode==='move'&&d.block)moveBlock(d.block,hit.point);
   if((d.mode==='left'||d.mode==='right')&&d.block){
    const old=d.block;
    const newStart=d.mode==='left'?clamp(snap5(hit.point),0,old.start+old.duration-5):old.start;
    const end=d.mode==='right'?clamp(snap5(hit.point),old.start+5,1440):old.start+old.duration;
    resizeBlock(old,newStart,end-newStart);
   }
  }else if(!d.active&&d.mode==='palette'&&d.tool){
   setSelected(p=>p?.id===d.tool?.id?null:d.tool!);
  }
  session.current=null;setVisual(null);
 };
 const moveSession=(e:PointerEvent)=>{
  const d=session.current;
  if(!d||e.pointerId!==d.pointerId)return;
  const distance=Math.hypot(e.clientX-d.fromX,e.clientY-d.fromY);
  if(!d.active){
   if(e.pointerType==='touch' && !d.holding && distance>9){
    if(d.timer)clearTimeout(d.timer);
    session.current=null;return;
   }
   if(e.pointerType==='mouse' && distance>5)d.active=true;
  }
  if(!d.active)return;
  e.preventDefault();
  const hit=tileHit(e.clientX,e.clientY);
  let duration=d.tool?.type==='activity'?d.tool.duration:d.block?.duration;
  if(d.block && hit && (d.mode==='left'||d.mode==='right')){
   duration=d.mode==='left'?d.block.start+d.block.duration-clamp(snap5(hit.point),0,d.block.start+d.block.duration-5)
    :clamp(snap5(hit.point),d.block.start+5,1440)-d.block.start;
  }
  setVisual({x:e.clientX,y:e.clientY,label:d.tool?.label||d.block?.title||'Sticker',duration,slot:hit?.slot});
 };
 useEffect(()=>{
  window.addEventListener('pointermove',moveSession,{passive:false});
  window.addEventListener('pointerup',finishSession);
  window.addEventListener('pointercancel',finishSession);
  return()=>{window.removeEventListener('pointermove',moveSession);window.removeEventListener('pointerup',finishSession);window.removeEventListener('pointercancel',finishSession);if(session.current?.timer)clearTimeout(session.current.timer)};
 });
 const begin=(e:ReactPointerEvent,mode:DragMode,tool?:Tool,block?:Block)=>{
  if(readOnly)return;
  e.stopPropagation();
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const d:DragSession={mode,pointerId:e.pointerId,tool,block,x:e.clientX,y:e.clientY,fromX:e.clientX,fromY:e.clientY,holding:e.pointerType!=='touch',active:false};
  if(e.pointerType==='touch'){
   d.timer=setTimeout(()=>{if(session.current===d){d.holding=true;d.active=true;setVisual({x:d.fromX,y:d.fromY,label:d.tool?.label||d.block?.title||'',duration:d.tool?.type==='activity'?d.tool.duration:d.block?.duration})}},350);
  }
  session.current=d;
 };
 const stampRow=(slot:number)=>logs.filter(l=>{const offset=offsetForClock(l.time);return offset>=slot&&offset<slot+30});
 const toolFromSelection=(slot:number)=>{
  if(!selected||readOnly)return false;
  placeTool(selected,slot,slot);
  setSelected(null);return true;
 };
 const clickTrack=(slot:number)=>{if(!toolFromSelection(slot))toggleTile(slot)};
 const logDelete=(entry:JournalEvent)=>{
  if(readOnly)return;
  if(window.confirm('Remove this recorded sticker from the day?'))makeChange(undefined,logsRef.current.filter(x=>x.id!==entry.id));
 };
 return <section className="sticker-planner">
  <header className="sticker-heading"><div><span className="sticker-eyebrow">✦ THE LITTLE WIZARD'S OBSERVATORY ✦</span><h2>Merlin's Celestial Schedule</h2><p>One day, one magical step at a time. Hold and drag a sticker to plan or record it.</p></div><span className="sticker-crescent">☾</span></header>
  <div className="sticker-counters">
   <div><span>SLEEP TARGET</span><strong>18h</strong></div>
   <div className="sticker-divider-star">✦</div>
   <div><span>PROJECTED SLEEP</span><strong>{displayDuration(planned)}</strong></div>
   <div><span>ACTUALLY LOGGED</span><strong>{displayDuration(logged)}</strong></div>
  </div>
  {!readOnly&&<div className="sticker-palettes">
   <div className="palette-heading"><b>Plan activities</b><small>Drag onto any half-hour tile · hold to drag on mobile</small></div>
   <div className="palette-scroll">{ACTIVITY_TOOLS.map(tool=><button type="button" key={tool.id} className={`palette-item palette-activity ${selected?.id===tool.id?'armed':''}`} onPointerDown={e=>begin(e,'palette',tool)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(tool)}}} title={`${tool.label}: ${tool.duration} minutes`}><span>{tool.emoji}</span><b>{tool.label}</b><small>{tool.duration}m</small></button>)}</div>
   <div className="palette-heading palette-log-heading"><b>Log Merlin's day</b><small>Drop a sticker onto the time it happened</small></div>
   <div className="palette-scroll">{LOG_TOOLS.map(tool=><button type="button" key={tool.id} className={`palette-item palette-log ${selected?.id===tool.id?'armed':''}`} onPointerDown={e=>begin(e,'palette',tool)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(tool)}}}><span>{tool.emoji}</span><b>{tool.label}</b></button>)}</div>
   {selected&&<div className="sticker-selection" role="status">Selected {selected.emoji} {selected.label}. Now tap a calendar tile to place it. <button type="button" onClick={()=>setSelected(null)}>Cancel</button></div>}
  </div>}
  <div className="sticker-calendar-heading"><b>4 AM → 4 AM</b><small>Tap ☾ / ✧ to toggle a half-hour · drag an activity's end grips to resize · tap ✔ to log sleep</small></div>
  <div className="sticker-calendar">
   {Array.from({length:HOUR_COUNT},(_,hour)=>{
    const hourStart=hour*60;
    return <div className="sticker-hour" key={hour}>
     <div className="sticker-hour-label">{clockAt(hourStart).replace(':00','')}<small>{hour===0?'DAY BEGINS':hour===22?'OVERNIGHT':''}</small></div>
     {[hourStart,hourStart+30].map(slot=>{
      const contents=pieces(blocks,slot);
      const sleep=contents.filter(x=>x.block.category==='sleep').reduce((n,p)=>n+p.duration,0);
      const state=sleep===30?'asleep':sleep===0?'awake':'mixed';
      const rowStamps=stampRow(slot);
      return <div key={slot} className={`sticker-tile tile-${state}`} data-calendar-tile={slot}>
       <div className="sticker-tile-top">
        <button type="button" disabled={readOnly} className="sticker-tile-toggle" onClick={()=>selected?toolFromSelection(slot):toggleTile(slot)} aria-label={`${clockAt(slot)} toggle ${state}`}><span>{clockCompact(slot)}</span><b>{state==='asleep'?'☾ Sleep':state==='awake'?'✧ Awake':`◐ ${sleep}m rest`}</b></button>
        {sleep>0&&<button className="sticker-slept" type="button" disabled={readOnly} title="Log / unlog this half hour of actual sleep" onClick={()=>markSleep(slot)}>{contents.some(p=>p.block.category==='sleep'&&p.block.actualSleep!=null)?'✓':'○'}</button>}
       </div>
       <div className="sticker-track" role="group" aria-label={`${clockAt(slot)} activities`} onClick={()=>clickTrack(slot)}>
        {contents.map((part,i)=>{
         const b=part.block;
         return <div key={b.id+'-'+i} className={`sticker-piece cat-${b.category}`} style={{left:`${(part.start-slot)/30*100}%`,width:`${part.duration/30*100}%`}} title={`${b.title} · ${b.duration} minutes`}>
          <span className="sticker-piece-body" onPointerDown={e=>b.category!=='sleep'&&b.category!=='other'?begin(e,'move',undefined,b):undefined} onClick={e=>{e.stopPropagation();if(selected)toolFromSelection(slot)}}>{part.duration>=10?categoryEmoji[b.category]:''}</span>
          {b.category!=='sleep'&&b.category!=='other'&&!readOnly&&part.start===b.start&&<button className="sticker-grip grip-left" title="Hold and drag to adjust start" aria-label={`Resize beginning of ${b.title}`} onPointerDown={e=>begin(e,'left',undefined,b)} onClick={e=>e.stopPropagation()}/>}
          {b.category!=='sleep'&&b.category!=='other'&&!readOnly&&part.start+part.duration===b.start+b.duration&&<button className="sticker-grip grip-right" title="Hold and drag to adjust end" aria-label={`Resize end of ${b.title}`} onPointerDown={e=>begin(e,'right',undefined,b)} onClick={e=>e.stopPropagation()}/>}
         </div>;
        })}
       </div>
       <div className="sticker-tile-bottom">
        <div className="sticker-placed-logs">{rowStamps.map(l=><button key={l.id} type="button" title={`${l.time} · ${l.kind} · tap to remove`} disabled={readOnly} onClick={()=>logDelete(l)}>{logSticker(l)}</button>)}</div>
        {!readOnly&&<span className="sticker-drop-hint">{rowStamps.length===0?'＋ drop stickers':''}</span>}
       </div>
      </div>;
     })}
    </div>;
   })}
  </div>
  <div className="sticker-footer-tools">{!readOnly?<><button type="button" className="sticker-save-default" onClick={onSaveDefault}><Save size={16}/> Save current routine as default</button><button type="button" className="sticker-plain" onClick={onResetFromDefault}><RotateCcw size={15}/> Load default</button>{undo&&<button type="button" className="sticker-plain" onClick={()=>{onBlocksChange(undo.blocks);onLogsChange(undo.logs);setUndo(null)}}><Undo2 size={15}/> Undo change</button>}</>:<span>✦ Historical day: view-only, safely preserved.</span>}</div>
  <div className="sticker-key"><span>☾ Sleep</span><span>🐾 Potty</span><span>🥣 Meals</span><span>🎾 Play</span><span>✨ Training</span><span>🌿 Walks</span><span>💧/💩 Daily logs</span></div>
  {visual&&<div className="sticker-drag-pop" style={{left:clamp(visual.x+13,10,typeof window==='undefined'?700:window.innerWidth-155),top:clamp(visual.y-64,8,typeof window==='undefined'?700:window.innerHeight-85)}}><span>{visual.label}</span>{visual.duration!=null&&<b>{minutesLabel(visual.duration)}</b>}</div>}
 </section>;
}
