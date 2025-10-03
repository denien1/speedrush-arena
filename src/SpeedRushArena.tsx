import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, MousePointerClick, TimerReset, Keyboard, Crosshair, Share2, RefreshCw, Target, Crown, Sparkles, Award, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { fetchTop, submitScore, supaReady, type ModeKey } from "@/lib/supabase";

const fmt = (n: number, digits = 0) => Number.isFinite(n) ? n.toFixed(digits) : "-";
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const sampleWords = `rapid neon pulse vector quantum turbo pixel blaze flux nova hyper ignite bolt drift snap orbit byte flash sonic echo boost apex shift gyro loop ripple quake prism laser ether surge vortex sprite comet spark fractal nano macro micro meta giga zeta zenith alpha bravo delta sigma lambda gamma theta omega atlas titan ember frost ember dune dune azure chrome scarlet cobalt verdant obsidian quartz basalt cedar maple amber lilac velvet satin marble cotton nylon silica lotus falcon jaguar panther lynx cobra viper sparrow eagle raven hawk crane heron lotus river ocean desert jungle arctic polar storm thunder lightning drizzle monsoon cyclone zephyr eclipse aurora nebula halo galaxy cosmos cosmos`.split(" ");

function useLocalStorage<T>(key: string, init: T) {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal] as const;
}

function seedFromDate(date = new Date()) {
  const d = new Date(date.toLocaleDateString("en-CA"));
  let s = d.getFullYear() * 1_000_000 + (d.getMonth()+1) * 10_000 + d.getDate() * 100 + 73;
  return s >>> 0;
}

function rng(seedRef: React.MutableRefObject<number>) {
  let x = seedRef.current || 2463534242; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; seedRef.current = x >>> 0; return (seedRef.current % 1_000_000) / 1_000_000;
}

type ScoreRow = { mode: ModeKey; value: number; label: string; ts: number };

function useLeaderboard() {
  const [rows, setRows] = useLocalStorage<ScoreRow[]>("speedrush:leaderboard", []);
  const add = (row: ScoreRow) => setRows(prev => { const next = [...prev, row].sort((a,b) => ranker(a,b)); return next.slice(0,100); });
  function ranker(a: ScoreRow, b: ScoreRow) {
    const va = a.mode === "reaction" ? -a.value : a.value; const vb = b.mode === "reaction" ? -b.value : b.value; return vb - va;
  }
  return { rows, add };
}

function BadgePill({ children }: { children: React.ReactNode }) { return (<span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-black/5">{children}</span>); }

function ReactionTest({ onScore }: { onScore: (ms: number) => void }) {
  const [phase, setPhase] = useState<"idle"|"wait"|"go"|"oops">("idle");
  const [ms, setMs] = useState<number | null>(null);
  const tRef = useRef<number>(0); const startRef = useRef<number>(0);
  function start(){ setMs(null); setPhase("wait"); const delay = 800 + Math.random()*1700; tRef.current = window.setTimeout(()=>{ startRef.current = performance.now(); setPhase("go"); }, delay); }
  function click(){ if(phase==="wait"){ clearTimeout(tRef.current); setPhase("oops"); setMs(null);} else if(phase==="go"){ const rt = performance.now()-startRef.current; setMs(rt); setPhase("idle"); onScore(rt);} else { start(); } }
  useEffect(()=>()=>clearTimeout(tRef.current),[]);
  return (
    <Card className="overflow-hidden">
      <CardHeader><CardTitle className="flex items-center gap-2"><TimerReset className="h-5 w-5"/>Reaction Time</CardTitle><CardDescription>Click when the card turns green.</CardDescription></CardHeader>
      <CardContent>
        <motion.div onClick={click} className={`h-56 rounded-2xl grid place-items-center cursor-pointer select-none text-white text-2xl font-semibold shadow-inner ${phase==="go"?"bg-green-500":""} ${phase==="wait"?"bg-amber-500":""} ${phase==="idle"||phase==="oops"?"bg-slate-800":""}`} animate={{ scale: phase === "go" ? 1.02 : 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
          {phase === "idle" && <div>Tap to start</div>}
          {phase === "wait" && <div>Wait…</div>}
          {phase === "go" && <div>GO!</div>}
          {phase === "oops" && <div>Too early! Tap to retry</div>}
        </motion.div>
        <div className="mt-4 flex items-center justify-between"><div className="text-sm text-slate-500">Best human ~120–150 ms</div><div className="text-xl font-bold">{ms? `${fmt(ms,0)} ms` : ""}</div></div>
      </CardContent>
    </Card>
  );
}

function CPSTest({ onScore }: { onScore: (cps: number) => void }){
  const DURATION = 5_000; const [running, setRunning] = useState(false); const [clicks, setClicks] = useState(0); const [startAt, setStartAt] = useState<number | null>(null);
  const left = startAt ? clamp(1 - (performance.now()-startAt)/DURATION, 0, 1) : 0;
  useEffect(()=>{ if(!running) return; const id = setInterval(()=>{}, 50); return ()=>clearInterval(id); },[running]);
  function tap(){ if(!running){ setRunning(true); setClicks(1); setStartAt(performance.now()); setTimeout(()=>{ setRunning(false); const cps = clicks/(DURATION/1000); onScore(cps); }, DURATION); } else { setClicks(c=>c+1);} }
  const cpsLive = running && startAt ? clicks / ((performance.now()-startAt)/1000) : 0;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><MousePointerClick className="h-5 w-5"/>Clicks Per Second</CardTitle><CardDescription>How fast can you click in 5 seconds?</CardDescription></CardHeader>
      <CardContent>
        <motion.button onClick={tap} className="w-full h-48 rounded-2xl grid place-items-center text-3xl font-bold bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow active:scale-[.99]" whileTap={{ scale: 0.98 }}>{running? "CLICK!" : "Start"}</motion.button>
        <div className="mt-4"><Progress value={(1-left)*100} /><div className="mt-2 flex items-center justify-between text-sm text-slate-500"><span>{running? `${fmt(cpsLive,2)} cps` : ""}</span><span>{running? `${(left*5).toFixed(1)}s left` : `${clicks} clicks`}</span></div></div>
      </CardContent>
    </Card>
  );
}

function TypingTest({ onScore }: { onScore: (wpm: number) => void }){
  const DURATION = 30_000; const [text, setText] = useState(""); const [target, setTarget] = useState<string[]>([]); const [startedAt, setStartedAt] = useState<number | null>(null); const [wpm, setWpm] = useState(0); const [acc, setAcc] = useState(100); const inputRef = useRef<HTMLInputElement>(null);
  useEffect(()=>{ reset(); },[]);
  function reset(){ const words = Array.from({length: 45}, () => sampleWords[Math.floor(Math.random()*sampleWords.length)]); setTarget(words); setText(""); setStartedAt(null); setWpm(0); setAcc(100); inputRef.current?.focus(); }
  useEffect(()=>{ if(!startedAt) return; const id = setInterval(()=> setWpm(calcWpm(text, startedAt)), 200); const t = setTimeout(()=>{ finish(); }, DURATION); return ()=>{ clearInterval(id); clearTimeout(t); } },[startedAt]);
  function calcWpm(t: string, s: number){ const elapsed = (performance.now()-s)/1000/60; const words = t.trim().split(/\s+/).filter(Boolean).length; return Math.round(words / Math.max(elapsed, 1/60)); }
  function onChange(e: React.ChangeEvent<HTMLInputElement>){ if(!startedAt) setStartedAt(performance.now()); const val = e.target.value; setText(val); const a = (val||"").split(""); const tgt = target.join(" ").slice(0, val.length).split(""); let ok = 0; for(let i=0;i<Math.min(a.length,tgt.length);i++){ if(a[i]===tgt[i]) ok++; } setAcc(Math.round((ok / Math.max(tgt.length,1)) * 100)); }
  function finish(){ onScore(wpm); reset(); }
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Keyboard className="h-5 w-5"/>Typing Sprint (30s)</CardTitle><CardDescription>Type the prompt quickly and accurately.</CardDescription></CardHeader>
      <CardContent>
        <div className="min-h-20 p-4 rounded-xl bg-slate-900 text-slate-100 text-sm leading-relaxed tracking-wide"><TargetLine target={target.join(" ")} typed={text} /></div>
        <div className="mt-3 flex items-center gap-3"><Input ref={inputRef} value={text} onChange={onChange} placeholder="Start typing to begin…" className="flex-1"/><Button variant="secondary" onClick={reset}><RefreshCw className="h-4 w-4 mr-1"/>Reset</Button></div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center"><Stat label="WPM" value={wpm} /><Stat label="Accuracy" value={`${acc}%`} /><Stat label="Time" value={startedAt? `${Math.max(0, (DURATION - (performance.now()-startedAt))/1000).toFixed(1)}s` : "30.0s"} /></div>
      </CardContent>
    </Card>
  );
}

function TargetLine({ target, typed }: { target: string, typed: string }){
  const out: React.ReactNode[] = []; for (let i=0;i<target.length;i++){ const ch = target[i]; const ok = typed[i] === ch; const passed = i < typed.length; out.push(<span key={i} className={passed? (ok?"text-emerald-400":"text-rose-400 underline decoration-rose-400") : "text-slate-400"}>{ch}</span>);} return <div className="font-mono">{out}</div>;
}
function Stat({ label, value }: { label: string, value: React.ReactNode }){ return (<div className="rounded-xl bg-slate-100 p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold">{value}</div></div>); }

function AimTrainer({ onScore }: { onScore: (score: number) => void }){
  const DURATION = 15_000; const [running, setRunning] = useState(false); const [hits, setHits] = useState(0); const [misses, setMisses] = useState(0); const [pos, setPos] = useState({x:50,y:50});
  function randomPos(){ setPos({ x: 10 + Math.random()*80, y: 10 + Math.random()*70 }); }
  function start(){ setRunning(true); setHits(0); setMisses(0); randomPos(); setTimeout(()=>{ setRunning(false); onScore(hits); }, DURATION); }
  function onAreaClick(){ if(!running) return; setMisses(m=>m+1); }
  function onTargetClick(e: React.MouseEvent){ e.stopPropagation(); setHits(h=>h+1); randomPos(); }
  const acc = hits + misses > 0 ? Math.round(hits/(hits+misses)*100) : 100;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Crosshair className="h-5 w-5"/>Aim Trainer (15s)</CardTitle><CardDescription>Click targets fast; misses reduce accuracy.</CardDescription></CardHeader>
      <CardContent>
        <div onClick={onAreaClick} className="relative h-56 rounded-2xl bg-slate-900 overflow-hidden">
          {running && (
            <motion.button onClick={onTargetClick} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full w-10 h-10 bg-white/90 grid place-items-center shadow" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} whileTap={{ scale: 0.9 }}>
              <Target className="h-6 w-6"/>
            </motion.button>
          )}
          {!running && (<div className="absolute inset-0 grid place-items-center"><Button onClick={start} size="lg"><Crown className="h-4 w-4 mr-2"/>Start</Button></div>)}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center"><Stat label="Hits" value={hits} /><Stat label="Misses" value={misses} /><Stat label="Accuracy" value={`${acc}%`} /></div>
      </CardContent>
    </Card>
  );
}

export default function SpeedRushArena(){
  const { rows, add } = useLeaderboard();
  const [name, setName] = useLocalStorage<string>("speedrush:name", "Player");
  const [compact, setCompact] = useLocalStorage<boolean>("speedrush:compact", false);
  const [toasts, setToasts] = useState<string[]>([]);
  const pushToast = (t: string) => { setToasts(prev => [...prev, t]); setTimeout(()=>setToasts(prev=>prev.slice(1)), 2000); }
  const seedRef = useRef<number>(seedFromDate());
  function record(mode: ModeKey, value: number, unit: string){
    const label = `${name} — ${mode} ${fmt(value, mode==="reaction"?0:2)} ${unit}`; add({ mode, value, label, ts: Date.now() });
    if(supaReady()) submitScore(name, mode, value).then(({error})=>{ if(error) pushToast('Global save failed'); else pushToast('Saved to global leaderboard'); });
    else pushToast('Saved locally (connect Supabase for global)');
  }
  const [ach, setAch] = useLocalStorage<Record<string, boolean>>("speedrush:achievements", {});
  function unlock(key: string){ if(!ach[key]){ setAch({...ach,[key]:true}); pushToast("Achievement unlocked!"); } }
  useEffect(()=>{ if(rows.length>=10) unlock("grinder"); },[rows.length]);
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <main className={`mx-auto ${compact?"max-w-4xl":"max-w-6xl"} px-4 py-10`}>
        <Header name={name} setName={setName} compact={compact} setCompact={setCompact} />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="reaction" className="w-full">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="reaction"><TimerReset className="h-4 w-4 mr-1"/>Reaction</TabsTrigger>
                <TabsTrigger value="cps"><MousePointerClick className="h-4 w-4 mr-1"/>CPS</TabsTrigger>
                <TabsTrigger value="typing"><Keyboard className="h-4 w-4 mr-1"/>Typing</TabsTrigger>
                <TabsTrigger value="aim"><Crosshair className="h-4 w-4 mr-1"/>Aim</TabsTrigger>
              </TabsList>
              <TabsContent value="reaction"><ReactionTest onScore={(ms)=>{ record("reaction", ms, "ms"); if (ms<200) unlock("lightning"); }} /></TabsContent>
              <TabsContent value="cps"><CPSTest onScore={(cps)=>{ record("cps", cps, "cps"); if (cps>=10) unlock("hummingbird"); }} /></TabsContent>
              <TabsContent value="typing"><TypingTest onScore={(wpm)=>{ record("typing", wpm, "WPM"); if (wpm>=80) unlock("word-wizard"); }} /></TabsContent>
              <TabsContent value="aim"><AimTrainer onScore={(hits)=>{ record("aim", hits, "hits"); if (hits>=30) unlock("sharpshooter"); }} /></TabsContent>
            </Tabs>
          </div>
          <div className="space-y-6">
            <DailyChallenge seedRef={seedRef} onShare={() => navigator.clipboard.writeText(window.location.href)} />
            <Leaderboard rows={rows} />
            <GlobalBoard />
            <Achievements ach={ach} />
          </div>
        </div>
      </main>
      <ToastStack toasts={toasts} />
    </div>
  );
}

function Header({ name, setName, compact, setCompact }: { name: string, setName: (v: string)=>void, compact: boolean, setCompact: (b:boolean)=>void }){
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-3"><motion.span initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>SpeedRush Arena</motion.span><Trophy className="h-8 w-8 text-amber-500"/></h1>
        <p className="text-slate-600 mt-1 max-w-prose">A competitive, addicting, and fun speed-testing playground. Beat your best scores, unlock badges, and top the global charts.</p>
      </div>
      <div className="flex items-center gap-2">
        <Input value={name} onChange={(e)=>setName(e.target.value)} className="w-40" placeholder="Your name"/>
        <div className="flex items-center gap-2 rounded-xl bg-white p-2 border border-slate-200 shadow-sm"><Settings2 className="h-4 w-4"/><span className="text-sm">Compact</span><Switch checked={compact} onCheckedChange={setCompact} /></div>
        <Button variant="secondary" onClick={() => { navigator.clipboard.writeText("Come play SpeedRush Arena: "+window.location.href); }}><Share2 className="h-4 w-4 mr-2"/>Share</Button>
      </div>
    </div>
  );
}

function Leaderboard({ rows }: { rows: ScoreRow[] }){
  const grouped = useMemo(() => {
    const m: Record<ModeKey, ScoreRow[]> = { reaction: [], cps: [], typing: [], aim: [] };
    for (const r of rows) m[r.mode].push(r);
    for (const k of Object.keys(m) as ModeKey[]) { m[k] = m[k].slice(0, 10); }
    return m;
  }, [rows]);
  function Row({ r, i }: { r: ScoreRow, i: number }){ const val = r.mode === "reaction" ? `${fmt(r.value,0)} ms` : (r.mode==="typing"? `${fmt(r.value,0)} WPM` : `${fmt(r.value,2)}`); return (<div className="flex items-center justify-between py-1.5 text-sm"><div className="flex items-center gap-2 min-w-0"><span className="text-xs w-5 text-right mr-1 text-slate-500">{i+1}.</span><span className="truncate">{r.label}</span></div><span className="tabular-nums text-slate-700">{val}</span></div>); }
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5"/>Local Leaderboards</CardTitle><CardDescription>Top 10 per mode (this device).</CardDescription></CardHeader>
      <CardContent>
        <div className="space-y-4">{(["reaction","cps","typing","aim"] as ModeKey[]).map((k) => (<div key={k}><div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{k}</div><div className="rounded-lg bg-slate-100 p-2">{grouped[k].length === 0 && <div className="text-sm text-slate-500">No scores yet. Play a round!</div>}{grouped[k].map((r,i)=> <Row r={r} i={i} key={r.ts+":"+i} />)}</div></div>))}</div>
      </CardContent>
    </Card>
  );
}

function Achievements({ ach }: { ach: Record<string, boolean> }){
  const items = [
    { key: "lightning", label: "Lightning Reflex — under 200 ms", icon: <Sparkles className="h-4 w-4"/> },
    { key: "hummingbird", label: "Hummingbird — 10+ CPS", icon: <MousePointerClick className="h-4 w-4"/> },
    { key: "word-wizard", label: "Word Wizard — 80+ WPM", icon: <Keyboard className="h-4 w-4"/> },
    { key: "sharpshooter", label: "Sharpshooter — 30+ hits", icon: <Crosshair className="h-4 w-4"/> },
    { key: "grinder", label: "Grinder — 10 saved scores", icon: <Award className="h-4 w-4"/> },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5"/>Achievements</CardTitle><CardDescription>Crush challenges to unlock.</CardDescription></CardHeader>
      <CardContent>
        <div className="space-y-2">{items.map(it => (<div key={it.key} className={`flex items-center justify-between rounded-lg p-2 ${ach[it.key]?"bg-emerald-50":"bg-slate-100"}`}><div className="flex items-center gap-2">{it.icon}<span>{it.label}</span></div><div className={`text-xs font-medium ${ach[it.key]?"text-emerald-600":"text-slate-500"}`}>{ach[it.key]?"Unlocked":"Locked"}</div></div>))}</div>
      </CardContent>
    </Card>
  );
}

function DailyChallenge({ seedRef, onShare }: { seedRef: React.MutableRefObject<number>, onShare: ()=>void }){
  const [played, setPlayed] = useLocalStorage<boolean>("speedrush:daily:played", false); const [score, setScore] = useLocalStorage<number>("speedrush:daily:score", 0);
  const plan = useMemo(()=>{ const s = { current: seedRef.current } as React.MutableRefObject<number>; return Array.from({length:5},()=>120+Math.floor(rng(s)*280)); },[seedRef]);
  function startDaily(){ let cancelled = false; setPlayed(true); setScore(0); let i=0; function round(){ if(cancelled||i>=plan.length) return; const target = plan[i]; const delay = 500 + Math.random()*800; setTimeout(()=>{ const goAt = performance.now(); const onClick = ()=>{ const rt = performance.now() - goAt; const diff = Math.abs(rt-target); const pts = Math.max(0, Math.round(150 - diff)); setScore(v=>v+pts); window.removeEventListener("click", onClick, true); i++; round(); }; window.addEventListener("click", onClick, true); }, delay);} round(); setTimeout(()=>{ cancelled = true; }, 25_000); }
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5"/>Daily Challenge</CardTitle><CardDescription>5 precise clicks. Same seed for everyone today.</CardDescription></CardHeader>
      <CardContent>
        <div className="flex items-center gap-3"><Button onClick={startDaily} disabled={played}>Play</Button><Button variant="secondary" onClick={onShare}><Share2 className="h-4 w-4 mr-2"/>Share</Button><BadgePill>Score: {score}</BadgePill></div>
        <p className="text-xs text-slate-500 mt-2">Come back tomorrow for a new seed.</p>
      </CardContent>
    </Card>
  );
}

function GlobalBoard(){
  const [tab, setTab] = useState<ModeKey>('reaction');
  const [items, setItems] = useState<{ name: string; value: number }[]>([])
  const [ready, setReady] = useState(supaReady())
  useEffect(()=>{ setReady(supaReady()) },[])
  useEffect(()=>{ let dead=false; async function load(){ const { data } = await fetchTop(tab, 10); if(!dead) setItems((data||[]).map((d:any)=>({ name:d.name, value:d.value }))); } if(ready) load(); else setItems([]); return ()=>{ dead=true } },[tab, ready])
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5"/>Global Leaderboard</CardTitle><CardDescription>{ready? 'Live top 10 worldwide' : 'Connect Supabase to enable global rankings'}</CardDescription></CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3">
          {(['reaction','cps','typing','aim'] as ModeKey[]).map(m => (
            <button key={m} onClick={()=>setTab(m)} className={`px-3 py-1.5 rounded-xl text-sm ${tab===m? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>{m}</button>
          ))}
        </div>
        <div className="rounded-xl bg-slate-50 p-2">
          {!ready && <div className="text-sm text-slate-500">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then reload.</div>}
          {ready && items.length===0 && <div className="text-sm text-slate-500">No scores yet. Be the first!</div>}
          {ready && items.map((it, i)=> (
            <div key={i} className="flex items-center justify-between py-1.5 text-sm"><div className="flex items-center gap-2"><span className="w-6 text-right mr-1 text-slate-500">{i+1}.</span><span className="font-medium">{it.name}</span></div><span className="tabular-nums">{tab==='reaction'? `${fmt(it.value,0)} ms` : tab==='typing'? `${fmt(it.value,0)} WPM` : fmt(it.value,2)}</span></div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ToastStack({ toasts }: { toasts: string[] }){
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map((t, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="rounded-2xl bg-slate-900 text-white px-4 py-2 shadow-lg">{t}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
