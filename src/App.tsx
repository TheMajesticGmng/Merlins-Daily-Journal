import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, CalendarDays, Download, LockKeyhole, LogOut, MoonStar, Save, ShieldCheck } from 'lucide-react';
import StickerPlanner from './StickerPlanner';
import { supabase, cloudConfigured } from './supabase';
import { type Block, type DayRecord, dateLocal, prettyDate, shiftDate, categoryEmoji } from './model';
import { calendarDate, blankForDay, normalizeDay, rotateLegacyBlocks, projectedMinutes, loggedMinutes, clockAt, offsetForClock } from './scheduleV2';

type Mode='local'|'cloud';
type Page='planner'|'history'|'settings';
type Profile={display_name:string;pet_name:string;pet_weight_lbs:string};
const DEFAULT_PROFILE:Profile={display_name:'',pet_name:'Merlin',pet_weight_lbs:'12.5'};
const PREFIX='merlins-handbook:v1:';
const dayKey=(date:string)=>PREFIX+'day:'+date;
const defaultKey=PREFIX+'default-4am';
const profileKey=PREFIX+'profile';
function errorText(e:unknown){return e instanceof Error?e.message:String(e)}
function readLocalDefault():Block[]|undefined{
 try {const v=localStorage.getItem(defaultKey);if(!v)return;const data=JSON.parse(v);if(Array.isArray(data)&&data.every((x:Block)=>typeof x?.start==='number'&&typeof x?.duration==='number'))return data;}catch{/* Default remains unset */}return;
}
function readLocalDay(date:string,template?:Block[]):DayRecord{
 try {const raw=localStorage.getItem(dayKey(date));if(raw){const data=JSON.parse(raw) as DayRecord;if(data.version===1&&Array.isArray(data.blocks))return normalizeDay(data)}}catch{/* fall back without deleting original data */}
 return blankForDay(template);
}
function getLogEmoji(log:DayRecord['logs'][number]){
 if(log.kind==='potty')return({pee:'💧',poop:'💩',both:'🐾',neither:'➖'} as Record<string,string>)[log.result||'neither'];
 return ({meal:'🥣',accident:'⚠️',training:'🏅',water:'💦',medication:'💊',crate:'🏠',behavior:log.mood==='frantic'?'⚡':'🌙',grooming:'🪮',social:'🌟',weight:'⚖️',other:'⭐'} as Record<string,string>)[log.kind]||'⭐';
}
function AuthGate({onLocal}:{onLocal:()=>void}){
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [signup,setSignup]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(e:FormEvent){
  e.preventDefault();if(!supabase)return;
  setBusy(true);setMessage('');
  try {const r=signup?await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin+import.meta.env.BASE_URL}}):await supabase.auth.signInWithPassword({email,password});
   if(r.error)throw r.error;if(signup&&!r.data.session)setMessage('Check your email to confirm your account.');}
  catch(e){setMessage(errorText(e))}finally{setBusy(false)}
 }
 return <div className="auth-card">
  <div className="auth-icon">☾ ✦</div><h2>{signup?'Open your observatory':'Welcome back to Merlin’s observatory'}</h2>
  <p>Sign in to save your little wizard’s days privately across devices.</p>
  <form className="stack gap12" onSubmit={submit}>
   <label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Password<input type="password" minLength={8} required autoComplete={signup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <button className="primary" type="submit" disabled={busy}>{busy?'Just a moment…':signup?'Create account':'Sign in'}</button>
  </form>
  {message&&<p className="notice" role="status">{message}</p>}
  <button className="text-button" onClick={()=>{setSignup(x=>!x);setMessage('')}}>{signup?'Already have an account? Sign in':'Create an account'}</button>
  <p className="auth-divider">or</p><button className="ghost" onClick={onLocal}>Preview on this device</button>
  <small>This preview uses browser storage, not encrypted cloud sync. It can be lost when the browser is cleared.</small>
 </div>;
}
function exportJson(data:unknown){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='merlin-journal-'+dateLocal()+'.json';a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function App(){
 const [mode,setMode]=useState<Mode>(cloudConfigured?'cloud':'local');
 const [user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(!cloudConfigured);
 const [date,setDate]=useState(calendarDate),[page,setPage]=useState<Page>('planner');
 const [defaultBlocks,setDefaultBlocks]=useState<Block[]|undefined>(readLocalDefault);
 const [record,setRecord]=useState<DayRecord>(()=>readLocalDay(calendarDate(),readLocalDefault()));
 const [profile,setProfile]=useState<Profile>(DEFAULT_PROFILE);
 const [notes,setNotes]=useState('');
 const [loading,setLoading]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const [history,setHistory]=useState<{date:string;rest:number;sleep:number;logs:number}[]>([]);
 const lastLoad=useRef(0),saveQueue=useRef<Promise<unknown>>(Promise.resolve());
 const currentIdentity=useRef('');
 const previousLiveDay=useRef(calendarDate());
 const defaultRef=useRef(defaultBlocks);defaultRef.current=defaultBlocks;
 const isHistorical=date<calendarDate();

 useEffect(()=>{if(!supabase)return;let alive=true;
  void supabase.auth.getSession().then(({data})=>{if(alive){setUser(data.session?.user??null);setAuthReady(true)}}).catch(()=>{if(alive)setAuthReady(true)});
  const subscription=supabase.auth.onAuthStateChange((_event,session)=>{if(alive)setUser(session?.user??null)});
  return()=>{alive=false;subscription.data.subscription.unsubscribe()};
 },[]);
 useEffect(()=>{currentIdentity.current=mode==='cloud'?(user?.id||'signed-out'):'local'},[mode,user?.id]);
 useEffect(()=>{
  const id=window.setInterval(()=>{
   const next=calendarDate();
   if(next!==previousLiveDay.current){
    const old=previousLiveDay.current;previousLiveDay.current=next;
    setDate(displayed=>displayed===old?next:displayed);
    setStatus('New day started at 4 AM. Yesterday remains in history.');
   }
  },30000);
  return()=>window.clearInterval(id);
 },[]);
 useEffect(()=>{let cancelled=false;
  async function getProfile(){
   try {
    if(mode==='local'){
     const raw=localStorage.getItem(profileKey);
     if(!cancelled)setProfile(raw?{...DEFAULT_PROFILE,...JSON.parse(raw)}:DEFAULT_PROFILE);
     if(!cancelled)setDefaultBlocks(readLocalDefault());
    }else if(user&&supabase){
     const {data,error}=await supabase.from('profiles').select('display_name,pet_name,pet_weight_lbs,default_schedule').eq('user_id',user.id).maybeSingle();
     if(error)throw error;
     if(!cancelled){
      setProfile(data?{display_name:data.display_name||'',pet_name:data.pet_name||'Merlin',pet_weight_lbs:data.pet_weight_lbs==null?'':String(data.pet_weight_lbs)}:DEFAULT_PROFILE);
      setDefaultBlocks(Array.isArray(data?.default_schedule)?data.default_schedule as Block[]:undefined);
     }
    }
   }catch(e){if(!cancelled)setError('Profile/default routine: '+errorText(e))}
  }
  void getProfile();
  return()=>{cancelled=true};
 },[mode,user]);

 const loadDay=useCallback(async(d:string)=>{const token=++lastLoad.current;
  setLoading(true);setError('');
  try{
   let data:DayRecord;
   if(mode==='local')data=readLocalDay(d,defaultRef.current);
   else if(user&&supabase){
    const res=await supabase.from('day_records').select('record').eq('user_id',user.id).eq('day_date',d).maybeSingle();
    if(res.error)throw res.error;
    data=res.data?.record&&Array.isArray(res.data.record.blocks)?normalizeDay(res.data.record as DayRecord):blankForDay(defaultRef.current);
   }else return;
   if(token===lastLoad.current){setRecord(data);setNotes(data.notes);setStatus('Ready to plan');}
  }catch(e){if(token===lastLoad.current)setError('Could not load this day: '+errorText(e))}
  finally{if(token===lastLoad.current)setLoading(false)}
 },[mode,user]);
 useEffect(()=>{if(mode==='cloud'&&!user)return;void loadDay(date)},[date,mode,user,defaultBlocks,loadDay]);

 const persist=useCallback((next:DayRecord)=>{
  const day=date;
  const value={...next,scheduleAnchor:4,updatedAt:new Date().toISOString()} as DayRecord;
  const identity=currentIdentity.current;
  setRecord(value);
  if(mode==='local'){
   try {localStorage.setItem(dayKey(day),JSON.stringify(value));setStatus('Saved to this device');}
   catch(e){setError('Could not save: '+errorText(e))}
  }else if(user&&supabase){
   setStatus('Saving…');
   saveQueue.current=saveQueue.current.catch(()=>undefined).then(async()=>{
    const {error}=await supabase!.from('day_records').upsert({user_id:user.id,day_date:day,record:value,updated_at:value.updatedAt},{onConflict:'user_id,day_date'});
    if(error)throw error;if(currentIdentity.current===identity)setStatus('Saved to your private account');
   }).catch(e=>{if(currentIdentity.current===identity)setError('Save failed: '+errorText(e))});
  }
 },[date,mode,user]);
 const updateBlocks=(blocks:Block[])=>persist({...record,template:'custom',blocks});
 const updateLogs=(logs:DayRecord['logs'])=>persist({...record,logs});
 const saveNotes=()=>{if(notes!==record.notes)persist({...record,notes})};
 async function saveProfile(){
  try{
   if(mode==='local')localStorage.setItem(profileKey,JSON.stringify(profile));
   else if(user&&supabase){const{error}=await supabase.from('profiles').upsert({user_id:user.id,display_name:profile.display_name,pet_name:profile.pet_name,pet_weight_lbs:profile.pet_weight_lbs?Number(profile.pet_weight_lbs):null,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error}
   setStatus('Profile saved');
  }catch(e){setError('Profile save failed: '+errorText(e))}
 }
 async function saveDefault(){
  const blocks=record.blocks.map(b=>({...b,id:'default-'+b.start+'-'+b.category,completed:false,actualSleep:null}));
  try{
   if(mode==='local')localStorage.setItem(defaultKey,JSON.stringify(blocks));
   else if(user&&supabase){
    const {error}=await supabase.from('profiles').upsert({user_id:user.id,display_name:profile.display_name,pet_name:profile.pet_name,pet_weight_lbs:profile.pet_weight_lbs?Number(profile.pet_weight_lbs):null,default_schedule:blocks,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error)throw error;
   }
   setDefaultBlocks(blocks);setStatus('New default saved. Future days will start with this routine.');
  }catch(e){setError('Could not save default: '+errorText(e))}
 }
 const resetDefault=()=>{
  if(!window.confirm('Load the saved default schedule? Current day activities and sleep checkmarks will be replaced, but your potty logs and notes will stay.'))return;
  persist({...record,template:'custom',blocks:blankForDay(defaultRef.current).blocks});
 };
 const loadHistory=useCallback(async()=>{
  try {
   const recent=Array.from({length:45},(_,i)=>shiftDate(calendarDate(),-i));
   let rows:{date:string;record:DayRecord}[]=[];
   if(mode==='local')rows=recent.map(d=>{try{const v=localStorage.getItem(dayKey(d));return v?{date:d,record:normalizeDay(JSON.parse(v) as DayRecord)}:null}catch{return null}}).filter((x):x is {date:string;record:DayRecord}=>!!x);
   else if(user&&supabase){
    const{data,error}=await supabase.from('day_records').select('day_date,record').eq('user_id',user.id).gte('day_date',recent.at(-1)!).lte('day_date',recent[0]);
    if(error)throw error;
    rows=(data||[]).map(r=>({date:r.day_date as string,record:normalizeDay(r.record as DayRecord)}));
   }
   setHistory(rows.map(r=>({date:r.date,rest:projectedMinutes(r.record.blocks),sleep:loggedMinutes(r.record.blocks),logs:r.record.logs.length})).sort((a,b)=>b.date.localeCompare(a.date)));
  }catch(e){setError('History failed: '+errorText(e))}
 },[mode,user]);
 useEffect(()=>{if(page==='history')void loadHistory()},[page,loadHistory]);
 const doExport=async()=>{
  try{
   let days:{day_date:string;record:DayRecord}[]=[];
   if(mode==='local')days=Object.keys(localStorage).filter(k=>k.startsWith(PREFIX+'day:')).map(k=>({day_date:k.slice(dayKey('').length),record:JSON.parse(localStorage.getItem(k)||'null') as DayRecord}));
   else if(user&&supabase){const{data,error}=await supabase.from('day_records').select('day_date,record').eq('user_id',user.id).order('day_date');if(error)throw error;days=data as typeof days||[];}
   exportJson({format:'merlins-daily-journal-v2',exported_at:new Date().toISOString(),days,defaultBlocks:defaultRef.current});
  }catch(e){setError('Export failed: '+errorText(e))}
 };
 if(!authReady)return <div className="boot">☾ Opening Merlin's observatory…</div>;
 return <div className="app-shell merlin-v2">
  <header className="hero"><div className="hero-inner"><div className="brand-mark">☾</div><div className="brand-title"><span>THE LITTLE WIZARD'S OBSERVATORY</span><h1>{profile.pet_name||'Merlin'}'s Daily Journal ✦</h1><p>Dreams, adventures, and all the little discoveries.</p></div><div className="hero-right"><img className="pet-portrait" src={import.meta.env.BASE_URL+'merlin-portrait.webp'} alt="Black poodle puppy Merlin"/><span className="hero-caption">One magical day at a time</span></div></div></header>
  <main className="app-body">
   {mode==='cloud'&&!user?<AuthGate onLocal={()=>setMode('local')}/>:<>
    <div className="topbar"><span className="account-status">{mode==='cloud'?<><ShieldCheck size={16}/> Private cloud journal · {user?.email}</>:<><LockKeyhole size={16}/> Device-only preview · no cloud sync</>}</span>
     <div className="topbar-actions">{mode==='local'&&cloudConfigured&&<button className="text-button" onClick={()=>setMode('cloud')}>Sign in</button>}{mode==='cloud'&&<button className="text-button" onClick={()=>supabase?.auth.signOut()}><LogOut size={14}/> Sign out</button>}</div>
    </div>
    <nav className="nav-tabs" aria-label="Journal sections"><button className={page==='planner'?'active':''} onClick={()=>setPage('planner')}><MoonStar size={17}/>Calendar</button><button className={page==='history'?'active':''} onClick={()=>setPage('history')}><CalendarDays size={17}/>Previous days</button><button className={page==='settings'?'active':''} onClick={()=>setPage('settings')}><Save size={17}/>Settings</button></nav>
    {page==='planner'&&<div className="datebar"><button className="round-button" aria-label="Previous day" onClick={()=>setDate(d=>shiftDate(d,-1))}><ArrowLeft size={18}/></button><div><span className="eyebrow">MERLIN'S ADVENTURE LOG</span><h2>{prettyDate(date)}</h2></div><button className="round-button" aria-label="Next day" onClick={()=>setDate(d=>shiftDate(d,1))}><ArrowRight size={18}/></button><label className="picker"><CalendarDays size={16}/><input type="date" value={date} aria-label="Choose day" onChange={e=>e.target.value&&setDate(e.target.value)}/></label><button className="today" onClick={()=>setDate(calendarDate())}>Today</button></div>}
    {error&&<div className="error-alert" role="alert"><span>{error}</span><button onClick={()=>setError('')}>Dismiss</button></div>}
    {loading?<div className="loading">Opening the pages of this day…</div>:<>
     {page==='planner'&&<>
      <StickerPlanner key={date+':'+mode} blocks={record.blocks} logs={record.logs} readOnly={isHistorical} onBlocksChange={updateBlocks} onLogsChange={updateLogs} onSaveDefault={()=>void saveDefault()} onResetFromDefault={resetDefault}/>
      <section className="panel journal-bottom">
       <div className="section-heading"><div><h2>✦ The day's little moments</h2><p>{record.logs.length} sticker{record.logs.length===1?'':'s'} recorded · tap a sticker on the calendar to remove it</p></div><span className="pill">{status||'Ready to log'}</span></div>
       <div className="journal-sticker-summary">{record.logs.length?record.logs.slice().sort((a,b)=>offsetForClock(a.time)-offsetForClock(b.time)).map(l=><span className="journal-sticker" key={l.id} title={l.kind+' '+l.time}>{getLogEmoji(l)} <small>{l.time}</small></span>):<span className="journal-empty">Your observations will appear here as stickers are dropped onto the calendar.</span>}</div>
       <label className="daily-notes-label" htmlFor="merlin-day-notes">Additional notes <small>(the one optional writing area)</small></label>
       <textarea id="merlin-day-notes" disabled={isHistorical} className="daily-notes" rows={4} value={notes} onChange={e=>setNotes(e.target.value)} onBlur={saveNotes} placeholder="What helped Merlin settle today? Anything unusual, funny or important?"/>
       {!isHistorical&&<div className="note-foot"><small>Notes save when you leave the field.</small><button className="secondary" onClick={saveNotes}><Save size={15}/> Save notes</button></div>}
       {isHistorical&&<p className="fine-print">This finished day is view-only. Future days always load from your chosen default, not yesterday's log.</p>}
      </section>
     </>}
     {page==='history'&&<section className="panel"><div className="section-heading"><div><h2>✦ Pages from Merlin's adventures</h2><p>Each saved calendar is kept as a viewable record. The current day begins anew at 4 AM.</p></div><button className="ghost" onClick={()=>void loadHistory()}>Refresh</button></div>
      {history.length===0?<p className="empty-state">Once you place stickers or change the schedule, saved days will appear here.</p>:<div className="history-list">{history.map(h=><button key={h.date} onClick={()=>{setDate(h.date);setPage('planner')}}><div><b>{prettyDate(h.date)}</b><small>{h.logs} stickers · {Math.floor(h.rest/60)}h {h.rest%60}m planned</small></div><div className="history-right">{Math.floor(h.sleep/60)}h {h.sleep%60}m logged<ArrowRight size={16}/></div></button>)}</div>}
     </section>}
     {page==='settings'&&<><section className="panel"><div className="section-heading"><div><h2>✦ Merlin's profile</h2><p>Account and pet details. Your calendar and sticker logs need no text boxes.</p></div></div><form className="form-grid" onSubmit={e=>{e.preventDefault();void saveProfile()}}><label>Display name<input value={profile.display_name} maxLength={80} onChange={e=>setProfile({...profile,display_name:e.target.value})}/></label><label>Pet name<input required maxLength={80} value={profile.pet_name} onChange={e=>setProfile({...profile,pet_name:e.target.value})}/></label><label>Weight (lb)<input type="number" min=".1" max="400" step=".1" value={profile.pet_weight_lbs} onChange={e=>setProfile({...profile,pet_weight_lbs:e.target.value})}/></label><div className="form-actions wide"><button className="primary" type="submit"><Save size={15}/> Save profile</button></div></form></section>
      <section className="panel"><h2>✦ Your journal's privacy</h2><div className="security-info"><ShieldCheck size={20}/><div><b>{mode==='cloud'?'Supabase account enabled':'Device-only preview'}</b><p>{mode==='cloud'?'Each account has private data with row-level access rules. Your notes are not end-to-end encrypted.':'Your preview stays in local browser storage until you connect Supabase. It will not automatically sync to another phone.'}</p></div></div><button className="secondary" onClick={()=>void doExport()}><Download size={16}/> Export all days and default (JSON)</button><p className="fine-print">Exports are unencrypted. Keep backups private. Sharing the same journal across separate accounts requires a future shared-household feature.</p></section>
     </>}
    </>}
   </>}
  </main>
  <footer className="footer">✦ From one small wizard's day to the next ✦ <span>Merlin's celestial journal · 4 AM daily reset</span></footer>
 </div>;
}
export default App;
