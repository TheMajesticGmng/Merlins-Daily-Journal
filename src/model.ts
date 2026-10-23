export const DAY_START = 7 * 60;
export const DAY_MINUTES = 1440;
export const categoryNames = {
  sleep: 'Sleep', potty: 'Potty', meal: 'Meal', walk: 'Walk', play: 'Play', training: 'Training', enrichment: 'Enrichment', social: 'Socialization', grooming: 'Grooming', settle: 'Wind down', cuddle: 'Cuddles', other: 'Other'
} as const;
export type Category = keyof typeof categoryNames;
export type Block = { id: string; start: number; duration: number; category: Category; title: string; details?: string; completed: boolean; actualSleep?: number | null };
export type PottyResult = 'pee' | 'poop' | 'both' | 'neither';
export type LogKind = 'potty' | 'meal' | 'accident' | 'behavior' | 'training' | 'weight' | 'water' | 'grooming' | 'social' | 'crate' | 'medication' | 'other';
export type JournalEvent = { id: string; kind: LogKind; time: string; result?: PottyResult; place?: 'outside' | 'inside'; meal?: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'; amount?: string; note?: string; mood?: string };
export type DayRecord = { version: 1; template: 'original' | 'restful' | 'custom'; blocks: Block[]; logs: JournalEvent[]; notes: string; mood: 'calm' | 'mixed' | 'frantic' | ''; updatedAt: string; scheduleAnchor?: 4 };
export const categories = Object.keys(categoryNames) as Category[];
export const makeId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random());
export const toClock = (offset: number): string => { const t = ((DAY_START + offset) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES; const hours = t / 60 | 0; const suffix = hours >= 12 ? 'PM' : 'AM'; return `${hours % 12 || 12}:${String(t % 60).padStart(2,'0')} ${suffix}`; };
export const toInputTime = (offset: number): string => { const m = ((DAY_START + offset) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES; return `${String(m / 60 | 0).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`; };
export const inputToOffset = (clock: string): number => { const [h,m]=clock.split(':').map(Number); const offset=h*60+m-DAY_START; return offset < 0 ? offset + DAY_MINUTES : offset; };
export const timeFromMinutes = (m: number): string => `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;
export const sleepMinutes = (blocks: Block[]) => blocks.filter(b=>b.category==='sleep').reduce((s,b)=>s+b.duration,0);
export const actualSleepMinutes = (blocks: Block[]) => blocks.filter(b=>b.category==='sleep' && b.actualSleep != null).reduce((s,b)=>s+(b.actualSleep||0),0);
export const loggedSleepCount = (blocks:Block[]) => blocks.filter(b=>b.category==='sleep' && b.actualSleep != null).length;
export function dateLocal(date = new Date()): string { const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }
export function shiftDate(date:string,by:number):string { const [y,m,d]=date.split('-').map(Number); const value=new Date(y,m-1,d+by); return dateLocal(value); }
export function prettyDate(date:string): string { const [y,m,d]=date.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}); }

// Minutes from 7 AM; the record spans 7 AM through 7 AM the following morning.
// Overnight potty breaks (2 AM and 6:30 AM) are intentionally NOT counted as sleep.
const baseline: Array<[number,number,Category,string,string?]> = [
[0,10,'potty','Morning potty'],[10,10,'meal','Breakfast','Blue Buffalo or current puppy food'],[20,10,'play','Gentle morning play'],
[30,90,'sleep','Morning nap'],[120,15,'potty','Potty break'],[135,15,'cuddle','Quiet cuddles'],[150,90,'sleep','Morning nap'],
[240,10,'potty','Potty break'],[250,15,'walk','Short exploratory walk','Vaccination-safe area; prioritize sniffing'],[265,15,'play','Light play'],[280,5,'training','Name and recall'],[285,15,'settle','Wind down'],
[300,60,'sleep','Midday nap'],[360,10,'potty','Potty break'],[370,15,'meal','Lunch'],[385,15,'training','Simple training','Crate, sit, name, place'],[400,20,'play','Play and enrichment'],
[420,10,'potty','2 PM potty break'],[430,20,'settle','Wind down'],[450,90,'sleep','Afternoon nap'],
[540,10,'potty','Potty break'],[550,15,'walk','Walk and sniff'],[565,15,'training','Positive training'],[580,20,'play','Playtime'],[600,15,'enrichment','Puzzle or sniffing game'],[615,15,'settle','Settle and relax'],
[630,60,'sleep','Evening nap'],[690,10,'potty','Potty break'],[700,15,'meal','Dinner'],[715,15,'play','Evening play'],[730,10,'training','Place / crate practice'],[740,25,'enrichment','Calm enrichment or socialization'],[765,15,'settle','Transition to calm'],
[780,10,'potty','8 PM potty break'],[790,20,'settle','Wind down'],[810,60,'sleep','Evening nap'],[870,10,'potty','Last potty'],[880,20,'cuddle','Cuddles and bedtime'],
[900,240,'sleep','Overnight sleep'],[1140,15,'potty','2 AM potty break'],[1155,255,'sleep','Overnight sleep'],[1410,15,'potty','6:30 AM potty break'],[1425,15,'sleep','Final rest']
];
export function buildTemplate(which: 'original' | 'restful'):Block[] {
  let items = baseline.map(([start,duration,category,title,details])=>({id:makeId(),start,duration,category,title,details,completed:false,actualSleep:null}));
  if(which === 'restful') {
    items=items.flatMap(b=>{
      if(b.start===250) return [{...b,duration:10,title:'Short sniff walk'}];
      if(b.start===265) return [{...b,start:260,duration:10,title:'Light play'}];
      if(b.start===280 || b.start===285) return [];
      if(b.start===300) return [{...b,start:270,duration:90,title:'Longer midday nap'}];
      if(b.start===370) return [{...b,duration:10,title:'Lunch'}];
      if(b.start===385) return [{...b,start:380,duration:10,title:'Gentle training'}];
      if(b.start===400) return [{...b,start:390,duration:30,category:'sleep',title:'Optional power nap',details:'Try if Merlin can settle; flexible',actualSleep:null}];
      if(b.start===550) return [{...b,duration:10,title:'Short sniff walk'}];
      if(b.start===565) return [{...b,start:560,duration:10,title:'Short training'}];
      if(b.start===580 || b.start===600 || b.start===615) return [];
      if(b.start===630) return [{...b,start:570,duration:120,title:'Longer afternoon nap'}];
      return [b];
    });
    // after 11 AM: 11:00-11:10 potty; 11:10-11:20 walk; 11:20-11:30 play; 11:30-1 sleep
    // 1:00-1:30 lunch and potty; 1:30-2 nap; 2-2:30 potty / settle
    // 4:00-4:30 potty/walk/training; 4:30-6:30 sleep (includes former 5:30-6:30 nap)
  }
  return items.sort((a,b)=>a.start-b.start);
}
export const blankDay = (kind: 'original' | 'restful'='original'): DayRecord => ({version:1,template:kind,blocks:buildTemplate(kind),logs:[],notes:'',mood:'',updatedAt:new Date().toISOString()});
export const categoryEmoji:Record<Category,string>={sleep:'🌙',potty:'🐾',meal:'🥣',walk:'🌿',play:'🎾',training:'✨',enrichment:'🧩',social:'🤝',grooming:'🪮',settle:'☁️',cuddle:'💛',other:'⭐'};
