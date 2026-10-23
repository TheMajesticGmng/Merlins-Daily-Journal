import { buildTemplate, type Block, type Category, type DayRecord, makeId } from './model.ts';

export const CALENDAR_START_HOUR=4;
export const SLOT=30;
const DAY=1440;
export const snap5=(n:number)=>Math.round(n/5)*5;
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/** The planner represents 4 AM to the following 4 AM, so daily rollover is unambiguous. */
export function calendarDate(now:Date=new Date()):string {
  const date=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(now.getHours()<4) date.setDate(date.getDate()-1);
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
export function clockAt(offset:number):string {
  const total=((CALENDAR_START_HOUR*60+offset)%DAY+DAY)%DAY;
  const h=Math.floor(total/60),min=total%60;
  return `${h%12||12}:${String(min).padStart(2,'0')} ${h<12?'AM':'PM'}`;
}
export function clockCompact(offset:number):string {
  const total=((CALENDAR_START_HOUR*60+offset)%DAY+DAY)%DAY;
  const h=Math.floor(total/60),min=total%60;
  return `${h%12||12}${min===0?'':':'+String(min).padStart(2,'0')}${h<12?'a':'p'}`;
}
export function offsetForClock(value:string):number {
  const [h,m]=value.split(':').map(Number);
  return (((h*60+m)-CALENDAR_START_HOUR*60)%DAY+DAY)%DAY;
}

/** Rotate the original 7 AM–7 AM routine into a 4 AM–4 AM timeline, splitting at the new boundary. */
export function rotateLegacyBlocks(blocks:Block[]):Block[] {
  const out:Block[]=[];
  for(const block of blocks){
    let left=clamp(block.duration,0,DAY),start=(block.start+180)%DAY;
    while(left>0) {
      const amount=Math.min(left,DAY-start);
      out.push({...block,id:makeId(),start,duration:amount,actualSleep:block.actualSleep===null||block.actualSleep===undefined?null:Math.round(block.actualSleep*(amount/block.duration))});
      left-=amount;start=0;
    }
  }
  return out.sort((a,b)=>a.start-b.start);
}
export function initialBlocks():Block[]{return rotateLegacyBlocks(buildTemplate('original'));}
export function projectedMinutes(blocks:Block[]):number{return blocks.filter(b=>b.category==='sleep').reduce((n,b)=>n+b.duration,0);}
export function loggedMinutes(blocks:Block[]):number{return blocks.filter(b=>b.category==='sleep'&&b.actualSleep!=null).reduce((n,b)=>n+(b.actualSleep??0),0);}
export function blankForDay(defaultBlocks?:Block[]):DayRecord {
  return {...({
    version:1,template:'custom',blocks:(defaultBlocks?.length?defaultBlocks:initialBlocks()).map(b=>({...b,id:makeId(),completed:false,actualSleep:null})),
    logs:[],notes:'',mood:'',updatedAt:new Date().toISOString(),scheduleAnchor:4
  } as DayRecord),scheduleAnchor:4};
}
export function normalizeDay(record:DayRecord):DayRecord{
  if((record as DayRecord&{scheduleAnchor?:number}).scheduleAnchor===4)return record;
  return {...record,blocks:rotateLegacyBlocks(record.blocks),scheduleAnchor:4} as DayRecord;
}
export function pieces(blocks:Block[],start:number,duration:number=SLOT){
  const end=start+duration;
  return blocks.filter(b=>b.start<end&&b.start+b.duration>start).map(b=>({block:b,start:Math.max(b.start,start),duration:Math.min(end,b.start+b.duration)-Math.max(start,b.start)})).sort((a,b)=>a.start-b.start);
}
/** Replaces a bounded interval and leaves every untouched portion intact. */
export function replaceSegment(blocks:Block[],start:number,duration:number,category:Category,title:string):Block[] {
  if(start<0||duration<5||start+duration>DAY||start%5!==0||duration%5!==0)throw Error('Invalid 5-minute activity interval');
  const end=start+duration;
  const remaining:Block[]=[];
  for(const b of blocks){
    if(b.start+b.duration<=start||b.start>=end){remaining.push(b);continue;}
    if(b.start<start)remaining.push({...b,id:makeId(),duration:start-b.start,actualSleep:null});
    if(b.start+b.duration>end)remaining.push({...b,id:makeId(),start:end,duration:b.start+b.duration-end,actualSleep:null});
  }
  remaining.push({id:makeId(),category,start,duration,title,completed:false,actualSleep:null});
  return remaining.sort((a,b)=>a.start-b.start);
}
export function switchSlot(blocks:Block[],start:number):Block[]{
  const tile=pieces(blocks,start);
  const sleep=tile.filter(x=>x.block.category==='sleep');
  if(sleep.length===0)return replaceSegment(blocks,start,SLOT,'sleep','Sweet dreams');
  let result=blocks;
  // Preserve potty/meal/training portions of mixed sleep tiles, and convert only the sleep slices.
  for(const p of sleep)result=replaceSegment(result,p.start,p.duration,'other','Free time');
  return result;
}
export function markSlotSleep(blocks:Block[],start:number):Block[]{
  const updates:Block[]=[];
  for(const b of blocks){
    const end=b.start+b.duration;
    if(b.category!=='sleep'||b.start>=start+SLOT||end<=start){updates.push(b);continue;}
    const from=Math.max(b.start,start),to=Math.min(end,start+SLOT);
    if(b.start<from)updates.push({...b,id:makeId(),duration:from-b.start});
    const current=b.actualSleep!=null;
    updates.push({...b,id:makeId(),start:from,duration:to-from,actualSleep:current?null:to-from});
    if(end>to)updates.push({...b,id:makeId(),start:to,duration:end-to});
  }
  return updates.sort((a,b)=>a.start-b.start);
}
export function layoutValid(blocks:Block[]):boolean{
  const sorted=[...blocks].sort((a,b)=>a.start-b.start);
  return sorted.length>0&&sorted[0].start===0&&sorted.at(-1)!.start+sorted.at(-1)!.duration===DAY&&sorted.every((b,i)=>b.duration>0&&(i===0||sorted[i-1].start+sorted[i-1].duration===b.start));
}
