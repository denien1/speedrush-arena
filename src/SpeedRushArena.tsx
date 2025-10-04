import React, { useEffect, useRef, useState } from "react";
import AdSlot from "./components/ui/AdSlot";
import { submitIfValid, fetchTop, supaReady, type ModeKey } from "./lib/supabase";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-2 bg-slate-200 rounded">
      <div className="h-2 bg-slate-900 rounded" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* --------------------------- Leaderboard --------------------------- */
function Leaderboard({ mode, title }: { mode: ModeKey; title: string }) {
  const [rows, setRows] = useState<Array<{ id: number; name: string; value: number }>>([]);

  async function refresh() {
    const { data } = await fetchTop(mode, 10);
    setRows((data as any[])?.map((r) => ({ id: r.id, name: r.name, value: r.value })) || []);
  }
  useEffect(() => { refresh(); }, [mode]);

  return (
    <div className="border rounded-xl p-4 mt-4">
      <div className="font-semibold mb-2">{title}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-500">No scores yet. Be the first!</div>
      ) : (
        <ol className="space-y-2 list-decimal pl-5">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-4">
              <span className="truncate">
                {r.name} — {mode === "typing" ? `${r.value.toFixed(2)} WPM`
                 : mode === "aim" ? `${r.value.toFixed(2)} hits`
                 : mode === "reaction" ? `${r.value.toFixed(2)} ms`
                 : `${r.value.toFixed(2)} CPS`}
              </span>
              <span className="tabular-nums">{mode === "reaction" ? r.value.toFixed(2) + " ms" : r.value.toFixed(2)}</span>
            </li>
          ))}
        </ol>
      )}
      <button className="mt-3 px-3 py-1 text-sm rounded bg-slate-100" onClick={refresh}>Refresh</button>
    </div>
  );
}

/* --------------------------- Reaction --------------------------- */
function ReactionGame({ playerName }: { playerName: string }) {
  const [state, setState] = useState<"idle" | "waiting" | "go" | "done">("idle");
  const [resultMs, setResultMs] = useState<number>(0);
  const startRef = useRef<number>(0);
  const toRef = useRef<any>();

  function reset() { setState("idle"); setResultMs(0); clearTimeout(toRef.current); }

  function start() {
    reset();
    setState("waiting");
    toRef.current = setTimeout(() => { startRef.current = Date.now(); setState("go"); }, 600 + Math.random() * 1200);
  }

  async function click() {
    if (state === "go") {
      const ms = Date.now() - startRef.current;
      setResultMs(ms);
      setState("done");
      await submitIfValid(playerName, "reaction", Number(ms.toFixed(2)));
    } else if (state === "waiting") {
      reset();
    } else {
      start();
    }
  }

  return (
    <div className="border rounded-xl p-4">
      <div className="font-semibold">Reaction Test</div>
      <div className="text-sm text-slate-500 mb-3">Click when it turns GO. Lower is better.</div>
      <div onClick={click}
        className={`h-40 rounded-2xl flex items-center justify-center text-xl font-bold cursor-pointer select-none ${state === "go" ? "bg-green-500 text-white" : "bg-slate-100"}`}>
        {state === "idle" && "Click to Start"}
        {state === "waiting" && "Wait..."}
        {state === "go" && "GO!"}
        {state === "done" && `${resultMs.toFixed(2)} ms (Click to try again)`}
      </div>
    </div>
  );
}

/* --------------------------- CPS --------------------------- */
function CPSGame({ playerName }: { playerName: string }) {
  const DURATION = 5;
  const [count, setCount] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [active, setActive] = useState(false);

  function start() { setCount(0); setLeft(DURATION); setActive(true); }

  useEffect(() => {
    if (!active) return;
    if (left <= 0) {
      const cps = count / DURATION;
      submitIfValid(playerName, "cps", Number(cps.toFixed(2)));
      setActive(false);
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [active, left, count]);

  return (
    <div className="border rounded-xl p-4">
      <div className="font-semibold">CPS Test (5s)</div>
      <div className="text-sm text-slate-500 mb-3">Click as fast as you can.</div>
      <div className="flex items-center gap-2 mb-3">
        <button className="px-3 py-1 rounded bg-slate-900 text-white disabled:opacity-50" onClick={start} disabled={active}>
          {active ? "Running…" : "Start"}
        </button>
        <div className="text-sm text-slate-600">Time left: {left}s</div>
      </div>
      <div onClick={() => active && setCount((c) => c + 1)}
           className="h-40 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl font-bold select-none cursor-pointer">
        {count} clicks
      </div>
      <div className="mt-3"><ProgressBar value={((DURATION - left) / DURATION) * 100} /></div>
    </div>
  );
}

/* --------------------------- Typing (WPM fix) --------------------------- */
const TYPING_TEXT =
  "amber quake loop panther sprite river nylon zeta dune ember jaguar sonic cosmos alpha fractal cosmos galaxy neon apex";

function TypingGame({ playerName }: { playerName: string }) {
  const DURATION = 30;
  const [active, setActive] = useState(false);
  const [left, setLeft] = useState(DURATION);
  const [typed, setTyped] = useState("");
  const [correctChars, setCorrectChars] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const submittedRef = useRef(false);

  function start() {
    setActive(true); setLeft(DURATION); setTyped(""); setCorrectChars(0);
    setStartMs(Date.now()); submittedRef.current = false;
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setTyped(text);
    const upto = TYPING_TEXT.slice(0, text.length);
    let ok = 0;
    for (let i = 0; i < text.length; i++) if (text[i] === upto[i]) ok++;
    setCorrectChars(ok);
  }

  async function finish() {
    if (submittedRef.current) return;
    const elapsedSec = Math.max(0.001, (Date.now() - startMs) / 1000);
    const words = correctChars / 5;
    const wpm = words / (elapsedSec / 60);
    const wpmRounded = Number.isFinite(wpm) ? Number(wpm.toFixed(2)) : 0;
    if (wpmRounded > 0) {
      await submitIfValid(playerName, "typing", wpmRounded);
      submittedRef.current = true;
    }
    setActive(false);
  }

  useEffect(() => {
    if (!active) return;
    if (left <= 0) { finish(); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [active, left]);

  const accuracy = typed.length ? (correctChars / typed.length) * 100 : 100;

  return (
    <div className="border rounded-xl p-4">
      <div className="font-semibold">Typing Sprint (30s)</div>
      <div className="text-sm text-slate-500 mb-3">Type accurately; score is true WPM.</div>
      <div className="text-sm text-slate-600 mb-2">Time left: {left}s</div>
      <div className="rounded-xl border bg-slate-50 p-3 text-sm mb-2">{TYPING_TEXT}</div>
      <input value={typed} onChange={onChange} disabled={!active} placeholder="Start typing to begin…"
             className="w-full border rounded px-3 py-2 mb-3" />
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><div className="text-slate-500">Chars correct</div><div className="font-semibold">{correctChars}</div></div>
        <div><div className="text-slate-500">Accuracy</div><div className="font-semibold">{Math.round(accuracy)}%</div></div>
        <div><div className="text-slate-500">Live WPM</div>
          <div className="font-semibold">
            {(() => {
              const sec = Math.max(0.001, (Date.now() - startMs) / 1000);
              const words = correctChars / 5;
              const wpm = words / (sec / 60);
              return Number.isFinite(wpm) ? wpm.toFixed(2) : "0.00";
            })()}
          </div></div>
      </div>
      <div className="flex gap-2 mt-4">
        <button className="px-3 py-1 rounded bg-slate-900 text-white disabled:opacity-50" onClick={start} disabled={active}>
          {active ? "Running…" : "Start"}
        </button>
        <button className="px-3 py-1 rounded bg-slate-100 disabled:opacity-50" onClick={finish} disabled={!active}>Finish</button>
      </div>
    </div>
  );
}

/** =========================
 *  Duck Hunt – Rounds Edition
 *  ========================= */
export default function AimGame({ playerName }: { playerName: string }) {
  /* ---------- SPRITE / SHEET CONFIG ---------- */
  const SPRITE_URL = "/duck-sprite.png"; // 6 columns: 0..3 fly, 4 shot, 5 dead
  const FRAME_W = 64, FRAME_H = 64, FLY_FRAMES = 4, SHOT_COL = 4, DEAD_COL = 5;

  /* ---------- LAYERS (PARALLAX) ---------- */
  const BG_URL = "/forest-bg.png";  // behind ducks
  const FG_URL = "/forest-fg.png";  // bushes in front of ducks/dog
  const SKY_COLORS = ["#cfe9ff", "#eaf7ff"]; // fallback gradient

  /* ---------- DOG SPRITE (optional) ---------- */
  const DOG_URL = "/dog-sprite.png";  // 3-frame running strip, 56x48 per frame

  /* ---------- AUDIO PACK (mp3/wav) ---------- */
  const SND = {
    shot:   "/sounds/shot.mp3",
    reload: "/sounds/reload.mp3",
    click:  "/sounds/click.mp3",  // dry-fire
    quack:  "/sounds/quack.mp3",
    bark:   "/sounds/bark.mp3",   // dog laugh
  } as const;

  /* ---------- DIFFICULTY ---------- */
  type DiffKey = "easy" | "medium" | "hard";
  const DIFF: Record<DiffKey, { ducks: number; speedMin: number; speedMax: number; mult: number }> = {
    easy:   { ducks: 4, speedMin: 80,  speedMax: 140, mult: 1 },
    medium: { ducks: 6, speedMin: 120, speedMax: 200, mult: 1.1 },
    hard:   { ducks: 9, speedMin: 170, speedMax: 260, mult: 1.25 },
  };

  /* ---------- ROUNDS CONFIG ---------- */
  const ROUNDS: Array<{ time: number; targetHits: number; duckCountBoost?: number }> = [
    { time: 15, targetHits: 12 },            // Round 1
    { time: 15, targetHits: 16, duckCountBoost: 2 }, // Round 2
    { time: 15, targetHits: 20, duckCountBoost: 4 }, // Round 3
  ];

  /* ---------- AMMO / RELOAD ---------- */
  const MAG_CAPACITY = 3;          // shells per clip
  const RELOAD_TIME_MS = 700;      // reload lockout
  const DRY_CLICK_LOCK_MS = 250;   // quick lock after dry fire

  /* ---------- PHYSICS ---------- */
  const GRAVITY = 800;
  const RESPAWN_MS = 220; // duck respawn delay (after dead)

  /* ---------- TYPES ---------- */
  type DuckState = "alive" | "falling" | "dead";
  type Duck = {
    id: number; x: number; y: number; vx: number; vy: number; rot: number;
    state: DuckState; face: 1 | -1; row: number; deadAt?: number;
  };

  type DogState = "off" | "runningOut" | "fetching" | "runningBack" | "laugh";
  type Dog = {
    x: number; y: number; face: 1 | -1; state: DogState; frame: number;
    target?: { x: number; y: number }; hasDuck: boolean;
  };

  /* ---------- STATE ---------- */
  const [difficulty, setDifficulty] = React.useState<DiffKey>("medium");

  const [roundIdx, setRoundIdx] = React.useState(0);
  const [inRound, setInRound] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState(ROUNDS[0].time);

  const [hits, setHits] = React.useState(0);
  const [misses, setMisses] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [combo, setCombo] = React.useState(0);
  const [bestCombo, setBestCombo] = React.useState(0);

  const [mag, setMag] = React.useState(MAG_CAPACITY);
  const [reloading, setReloading] = React.useState(false);
  const [lastDryClickAt, setLastDryClickAt] = React.useState(0);

  const [showPanel, setShowPanel] = React.useState<{title:string; subtitle:string; action:string} | null>(null);

  /* ---------- REFS ---------- */
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef    = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef       = React.useRef<number>();
  const lastTsRef    = React.useRef<number>(0);

  const ducksRef     = React.useRef<Duck[]>([]);
  const rowsRef      = React.useRef<number>(1);
  const submittedRef = React.useRef(false);

  // images
  const bgImgRef     = React.useRef<HTMLImageElement | null>(null);
  const fgImgRef     = React.useRef<HTMLImageElement | null>(null);
  const spriteRawRef = React.useRef<HTMLImageElement | null>(null);
  const spriteKeyedRef = React.useRef<HTMLCanvasElement | null>(null);
  const dogImgRef    = React.useRef<HTMLImageElement | null>(null);

  // parallax
  const bgScrollRef  = React.useRef(0);
  const fgScrollRef  = React.useRef(0);

  // dog
  const dogRef       = React.useRef<Dog>({ x: -100, y: 0, face: 1, state: "off", frame: 0, hasDuck:false });

  // muzzle flashes + recoil
  type Flash = { x:number; y:number; t0:number; life:number };
  const flashesRef   = React.useRef<Flash[]>([]);
  const shakeRef     = React.useRef<{dx:number;dy:number;t:number}>({dx:0,dy:0,t:0});

  // audio
  const audioRefs = React.useRef<Record<keyof typeof SND, HTMLAudioElement | null>>({
    shot: null, reload: null, click: null, quack: null, bark: null
  });

  /* ---------- INIT ASSETS ---------- */
  React.useEffect(() => {
    // background
    const bg = new Image(); bg.src = BG_URL; bg.onload = ()=> bgImgRef.current = bg;
    const fg = new Image(); fg.src = FG_URL; fg.onload = ()=> fgImgRef.current = fg;

    // duck sprite
    const spr = new Image(); spr.src = SPRITE_URL;
    spr.onload = () => {
      spriteRawRef.current = spr;
      rowsRef.current = Math.max(1, Math.floor(spr.height / FRAME_H));
      spriteKeyedRef.current = chromaKeySprite(spr, [235,235,235], 28);
      fitCanvas(); draw(0);
    };

    // dog sprite (optional)
    const dog = new Image(); dog.src = DOG_URL; dog.onload = ()=> dogImgRef.current = dog;

    // sounds
    for (const key of Object.keys(SND) as (keyof typeof SND)[]) {
      try {
        const a = new Audio(SND[key]);
        a.preload = "auto";
        audioRefs.current[key] = a;
      } catch { audioRefs.current[key] = null; }
    }
  }, []);

  /* ---------- CANVAS FIT ---------- */
  function fitCanvas() {
    const c = canvasRef.current, box = containerRef.current;
    if (!c || !box) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = box.clientWidth;
    const h = Math.round(w * 0.50);
    c.style.width = `${w}px`; c.style.height = `${h}px`;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext("2d")!; g.setTransform(dpr,0,0,dpr,0,0); g.imageSmoothingEnabled=false;
  }
  React.useEffect(() => {
    fitCanvas();
    const r = new ResizeObserver(fitCanvas);
    if (containerRef.current) r.observe(containerRef.current);
    return () => r.disconnect();
  }, []);

  /* ---------- HELPERS ---------- */
  const rand = (a:number,b:number)=>a+Math.random()*(b-a);
  function size(){ const c=canvasRef.current; return c?{w:c.clientWidth,h:c.clientHeight}:{w:600,h:300}; }

  function makeDuck(id:number): Duck {
    const { w, h } = size();
    const diff = DIFF[difficulty];
    const sp = rand(diff.speedMin, diff.speedMax);
    const face:1|-1 = Math.random()<0.5?1:-1;
    const ang = rand(-Math.PI*0.35, Math.PI*0.35);
    return {
      id,
      x: rand(FRAME_W/2, w-FRAME_W/2),
      y: rand(FRAME_H/2+8, h*0.7),
      vx: Math.cos(ang)*sp*face,
      vy: Math.sin(ang)*sp*0.35,
      rot: 0, state: "alive", face,
      row: Math.floor(Math.random()*rowsRef.current)
    };
  }

  function spawnDucksForRound() {
    const base = DIFF[difficulty].ducks;
    const boost = ROUNDS[roundIdx].duckCountBoost ?? 0;
    const total = base + boost;
    ducksRef.current = Array.from({ length: total }, (_,i)=> makeDuck(i+1));
  }

  /* ---------- ROUND FLOW ---------- */
  function startRound(idx = roundIdx) {
    // reset HUD
    setHits(0); setMisses(0); setScore(0); setCombo(0); setBestCombo(0);
    setMag(MAG_CAPACITY); setReloading(false);
    setTimeLeft(ROUNDS[idx].time);
    setShowPanel(null);

    // entities
    dogRef.current = { x: -120, y: 0, face: 1, state:"off", frame:0, hasDuck:false };
    spawnDucksForRound();

    // loop
    setInRound(true);
    lastTsRef.current = 0;
    cancelAnimationFrame(rafRef.current!);
    rafRef.current = requestAnimationFrame(step);
  }

  function endRound(success: boolean) {
    setInRound(false);
    // dog laugh if failed
    if (!success) { dogRef.current = {...dogRef.current, state:"laugh"}; play("bark"); }
    // panel
    const { targetHits } = ROUNDS[roundIdx];
    const nextExists = roundIdx < ROUNDS.length - 1;
    setShowPanel({
      title: success ? "Round Complete!" : "Round Failed",
      subtitle: `Hits: ${hits} / ${targetHits}`,
      action: success
        ? (nextExists ? "Next Round" : "Finish")
        : "Retry Round"
    });
    // submit current score to global (only when success OR final)
    if (!submittedRef.current && hits > 0) {
      submitIfValid(playerName, "aim", hits).catch(()=>{});
      submittedRef.current = true;
    }
  }

  React.useEffect(() => {
    if (!inRound) return;
    if (timeLeft <= 0) {
      const success = hits >= ROUNDS[roundIdx].targetHits;
      endRound(success);
      return;
    }
    const t = setTimeout(()=>setTimeLeft(s=>s-1), 1000);
    return () => clearTimeout(t);
  }, [inRound, timeLeft]);

  /* ---------- SOUND ---------- */
  function play(name: keyof typeof SND) {
    const a = audioRefs.current[name];
    if (!a) return; // if not loaded, quietly skip
    try { a.currentTime = 0; void a.play(); } catch {}
  }

  /* ---------- LOOP ---------- */
  function step(ts:number) {
    if (!inRound) return;
    if (!lastTsRef.current) lastTsRef.current = ts;
    const dt = Math.max(0, Math.min((ts - lastTsRef.current)/1000, 0.05));
    lastTsRef.current = ts;

    const { w, h } = size();
    const ground = h - FRAME_H/2;

    ducksRef.current = ducksRef.current.map(d=>{
      let {x,y,vx,vy,rot,state,face,row,deadAt} = d;
      if (state==="alive") {
        x += vx*dt; y += vy*dt;
        if (x<=FRAME_W/2){ x=FRAME_W/2; vx=Math.abs(vx); face=1; }
        if (x>=w-FRAME_W/2){ x=w-FRAME_W/2; vx=-Math.abs(vx); face=-1; }
        if (y<=FRAME_H/2){ y=FRAME_H/2; vy=Math.abs(vy)*0.6; }
        if (y>=h*0.7){ y=h*0.7; vy=-Math.abs(vy)*0.6; }
      } else if (state==="falling") {
        vy += GRAVITY*dt; y += vy*dt; rot += 360*dt*0.8;
        if (y>=ground){ y=ground; vy=0; vx=0; state="dead"; deadAt=performance.now(); }
      } else if (state==="dead") {
        // respawn after the dog picks it up or timeout fallback
        if (deadAt && performance.now()-deadAt > RESPAWN_MS*6) {
          return makeDuck(d.id);
        }
      }
      return {...d,x,y,vx,vy,rot,state,face,row,deadAt};
    });

    // schedule dog fetch or laugh
    tryDogJobs();

    // parallax
    bgScrollRef.current = (bgScrollRef.current + dt*60) % 800;
    fgScrollRef.current = (fgScrollRef.current + dt*100) % 800;

    // flash decay
    flashesRef.current = flashesRef.current.filter(f => performance.now()-f.t0 < f.life);

    // recoil decay
    if (shakeRef.current.t>0) { shakeRef.current.t -= dt; if (shakeRef.current.t<0) shakeRef.current.t=0; }

    draw(dt);
    rafRef.current = requestAnimationFrame(step);
  }

  function tryDogJobs() {
    const { h } = size();
    const ground = h - FRAME_H/2;
    const dog = dogRef.current;

    // laugh if misses outweigh hits 2:1 during the round
    if (inRound && misses >= Math.max(6, hits*2) && dog.state==="off") {
      dogRef.current = { ...dog, state:"laugh", x: h*0.15, y: ground+6, face:1, frame:0, hasDuck:false };
      play("bark");
      setTimeout(()=>{ if (dogRef.current.state==="laugh") dogRef.current = {...dogRef.current, state:"off"}; }, 1400);
      return;
    }

    // fetch if a duck is dead on ground and dog is available
    const dead = ducksRef.current.find(d=> d.state==="dead" && d.y>=ground-1);
    if (dead && (dog.state==="off" || dog.state==="runningBack")) {
      dogRef.current = {
        x: -100, y: ground+6, face:1, state:"runningOut", frame:0,
        target:{x:dead.x,y:ground}, hasDuck:false
      };
    }

    // move dog
    const d = dogRef.current;
    if (d.state==="runningOut" && d.target) {
      d.face = d.x < d.target.x ? 1 : -1;
      d.x += (120*d.face) * (1/60);
      if ((d.face===1 && d.x >= d.target.x-20) || (d.face===-1 && d.x <= d.target.x+20)) {
        d.state="fetching"; d.frame=0; d.hasDuck=true;
      }
    } else if (d.state==="fetching") {
      d.frame += 1/10;
      if (d.frame>1) d.state="runningBack";
    } else if (d.state==="runningBack") {
      d.x -= 140 * (1/60);
      if (d.x < -120) { d.state="off"; d.hasDuck=false; d.target=undefined; }
    }
  }

  /* ---------- INPUT ---------- */
  function reload() {
    if (reloading || !inRound) return;
    setReloading(true);
    play("reload");
    setTimeout(() => { setMag(MAG_CAPACITY); setReloading(false); }, RELOAD_TIME_MS);
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (!inRound) return;
    const now = performance.now();

    if (reloading || mag<=0) {
      // dry click lock
      if (now - lastDryClickAt > DRY_CLICK_LOCK_MS) {
        setLastDryClickAt(now);
        play("click");
        flashesRef.current.push({ x:0, y:0, t0:now, life:120 }); // faint flash
        shakeRef.current = { dx:0, dy:0, t:0.06 };
      }
      return;
    }

    // fire
    setMag(m => Math.max(0, m-1));
    play("shot");

    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    flashesRef.current.push({ x:px, y:py, t0:performance.now(), life:110 });
    shakeRef.current = { dx:(Math.random()-0.5)*2, dy:-2, t:0.12 };

    // hit test
    for (let i = ducksRef.current.length-1; i>=0; i--) {
      const d = ducksRef.current[i];
      if (d.state!=="alive") continue;
      const dx=px-d.x, dy=py-d.y, r=Math.min(FRAME_W,FRAME_H)*0.45;
      if (dx*dx+dy*dy <= r*r) {
        ducksRef.current[i] = { ...d, state:"falling", vy:-160 };
        setHits(h=>h+1);
        setCombo(c=>{
          const next=c+1; setBestCombo(b=>Math.max(b,next));
          const mult=DIFF[difficulty].mult, bonus=1+next*0.10;
          setScore(s=> Number((s + 1*mult*bonus).toFixed(2)) );
          return next;
        });
        play("quack");
        return;
      }
    }
    setMisses(m=>m+1);
    setCombo(0);
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase()==="r") reload();
      if (!inRound && showPanel) {
        if (e.key === "Enter") handlePanelAction();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inRound, showPanel, roundIdx]);

  /* ---------- DRAW ---------- */
  function draw(_dt:number) {
    const c = canvasRef.current; if (!c) return;
    const g = c.getContext("2d")!;
    const { w, h } = size();

    // camera shake
    const sh = shakeRef.current.t>0 ? shakeRef.current.t : 0;
    const camX = (Math.random()-0.5)*2*sh*6 + shakeRef.current.dx*6*sh;
    const camY = (Math.random()-0.5)*2*sh*6 + shakeRef.current.dy*6*sh;

    g.setTransform(1,0,0,1,0,0);
    g.translate(camX, camY);
    g.imageSmoothingEnabled = false;

    // sky
    const grad=g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0, SKY_COLORS[0]); grad.addColorStop(1, SKY_COLORS[1]);
    g.fillStyle=grad; g.fillRect(0,0,w,h);

    // BG parallax
    const bg = bgImgRef.current;
    if (bg && bg.complete) {
      const scale = h / bg.height;
      const tw = bg.width * scale;
      const x = -Math.floor(bgScrollRef.current) % tw;
      g.drawImage(bg, x, 0, tw, h);
      g.drawImage(bg, x + tw, 0, tw, h);
    }

    // Ducks (middle layer)
    const spr = spriteKeyedRef.current || spriteFallback(spriteRawRef.current);
    if (spr) {
      ducksRef.current.forEach(d=>{
        const sx = (d.state==="alive")
          ? Math.floor((performance.now()/120)%FLY_FRAMES) * FRAME_W
          : (d.state==="falling" ? SHOT_COL*FRAME_W : DEAD_COL*FRAME_W);
        const sy = d.row * FRAME_H;
        g.save();
        g.translate(d.x, d.y);
        g.scale(d.face,1);
        g.rotate(d.rot*Math.PI/180);
        g.drawImage(spr, sx, sy, FRAME_W, FRAME_H, -FRAME_W/2, -FRAME_H/2, FRAME_W, FRAME_H);
        g.restore();
      });
    }

    // Dog draws in the same plane as ducks
    drawDog(g, w, h);

    // FG parallax (above ducks & dog)
    const fg = fgImgRef.current;
    if (fg && fg.complete) {
      const scale = h / fg.height;
      const tw = fg.width * scale;
      const x = -Math.floor(fgScrollRef.current) % tw;
      g.drawImage(fg, x, 0, tw, h);
      g.drawImage(fg, x + tw, 0, tw, h);
    }

    // muzzle flashes (on top)
    drawFlashes(g);
  }

  function drawFlashes(g:CanvasRenderingContext2D){
    const now = performance.now();
    for (const f of flashesRef.current) {
      const t = (now - f.t0)/f.life; if (t>1) continue;
      const a = 1 - t;
      g.save();
      g.translate(f.x, f.y);
      g.rotate((Math.random()-0.5)*0.2);
      g.fillStyle = `rgba(255,240,140,${0.55*a})`;
      g.beginPath(); g.moveTo(0,0); g.lineTo(18,6); g.lineTo(18,-6); g.closePath(); g.fill();
      g.fillStyle = `rgba(255,255,255,${0.8*a})`;
      g.beginPath(); g.arc(0,0,4,0,Math.PI*2); g.fill();
      g.restore();
    }
  }

  function drawDog(g:CanvasRenderingContext2D, _w:number, h:number){
    const ground = h - FRAME_H/2;
    const d = dogRef.current;
    if (d.state==="off") return;
    d.y = ground + 6;

    // laugh pose (simple vector if no sprite)
    if (d.state==="laugh") {
      g.save(); g.translate(_w*0.5, d.y); g.scale(1,1);
      g.fillStyle="#6b3f1f"; g.fillRect(-20,-18,40,20);
      g.fillStyle="#7a4b28"; g.fillRect(16,-28,16,16);
      g.fillStyle="#000";    g.fillRect(30,-22,4,4);
      g.fillStyle="#3e2312"; g.fillRect(-16,0,10,6); g.fillRect(6,0,10,6);
      // "laugh" mouth
      g.fillStyle="#fff"; g.fillRect(20,-16,8,4);
      g.restore();
      return;
    }

    // running/fetching
    const img = dogImgRef.current;
    if (img && img.complete) {
      const DW=56, DH=48, DCOLS=3, ROW=0;
      const frame = Math.floor((performance.now()/120)%DCOLS);
      const sx = (d.state==="runningOut" || d.state==="runningBack") ? frame*DW : 0;
      const sy = ROW*DH;
      g.save(); g.translate(d.x, d.y); g.scale(d.face,1);
      if (d.hasDuck){ g.fillStyle="rgba(0,0,0,0.15)"; g.fillRect(-16,-DH+6,24,10); }
      g.drawImage(img, sx, sy, DW, DH, -DW/2, -DH, DW, DH);
      g.restore();
      return;
    }

    // vector fallback
    g.save(); g.translate(d.x, d.y); g.scale(d.face,1);
    g.fillStyle="#6b3f1f"; g.fillRect(-20,-18,40,20);
    g.fillStyle="#7a4b28"; g.fillRect(16,-28,16,16);
    g.fillStyle="#3e2312"; g.fillRect(-16,0,10,6); g.fillRect(6,0,10,6);
    g.fillStyle="#000";    g.fillRect(30,-22,4,4);
    if (d.hasDuck){ g.fillStyle="#222"; g.fillRect(-12,-26,24,8); }
    g.restore();
  }

  /* ---------- SPRITE UTILS ---------- */
  function spriteFallback(img: HTMLImageElement | null) {
    if (!img) return null;
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return c;
  }
  function chromaKeySprite(img: HTMLImageElement, key:[number,number,number], tol:number) {
    const [kr,kg,kb]=key; const w=img.width, h=img.height;
    const c=document.createElement("canvas"); c.width=w; c.height=h;
    const g=c.getContext("2d")!; g.imageSmoothingEnabled=false; g.drawImage(img,0,0);
    const data=g.getImageData(0,0,w,h); const p=data.data;
    for (let i=0;i<p.length;i+=4){ const r=p[i], g1=p[i+1], b=p[i+2];
      if (Math.abs(r-kr)<=tol && Math.abs(g1-kg)<=tol && Math.abs(b-kb)<=tol) p[i+3]=0;
    }
    g.putImageData(data,0,0); return c;
  }

  /* ---------- PANEL ACTION ---------- */
  function handlePanelAction() {
    const success = hits >= ROUNDS[roundIdx].targetHits;
    if (success) {
      if (roundIdx < ROUNDS.length - 1) {
        setRoundIdx(i => i+1);
        startRound(roundIdx + 1);
      } else {
        // Finished all rounds
        setShowPanel(null);
      }
    } else {
      // retry current round
      startRound(roundIdx);
    }
  }

  /* ---------- UI ---------- */
  return (
    <div className="border rounded-2xl p-4">
      <div className="font-semibold">Duck Hunt – Rounds</div>
      <div className="text-sm text-slate-500 mb-3">
        Shoot {ROUNDS[roundIdx].targetHits} ducks in {ROUNDS[roundIdx].time}s.  
        Rounds: {roundIdx+1}/{ROUNDS.length}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-slate-600">Difficulty:</span>
        {(["easy","medium","hard"] as DiffKey[]).map(k=>(
          <button
            key={k}
            className={`px-3 py-1 rounded ${difficulty===k?"bg-slate-900 text-white":"bg-slate-100"}`}
            onClick={()=>!inRound && setDifficulty(k)}
            disabled={inRound}
            title={`×${DIFF[k].mult}`}
          >
            {k[0].toUpperCase()+k.slice(1)} (×{DIFF[k].mult})
          </button>
        ))}
        <button
          className="ml-auto px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
          onClick={()=>startRound(roundIdx)}
          disabled={inRound}
        >
          {inRound ? "Running..." : (roundIdx===0 ? "Start Round 1" : "Restart Round")}
        </button>
        <div className="text-sm text-slate-600">Time: {timeLeft}s</div>
      </div>

      {/* Arena */}
      <div ref={containerRef} className="relative h-72 rounded-2xl overflow-hidden select-none bg-black">
        {/* Ammo + Reload */}
        <div className="absolute top-2 right-3 z-20 flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({length: MAG_CAPACITY}).map((_,i)=>(
              <div key={i} className={`w-3 h-6 rounded-sm ${i < mag ? "bg-amber-500" : "bg-slate-400"}`} />
            ))}
          </div>
          <button
            className="px-2 py-1 rounded bg-slate-800 text-white text-xs disabled:opacity-50"
            onClick={reload}
            disabled={reloading || !inRound}
            title="Reload (R)"
          >
            {reloading ? "Reloading..." : "Reload"}
          </button>
        </div>

        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          className="absolute inset-0 w-full h-full cursor-crosshair"
        />

        {/* Between-round panel */}
        {!inRound && showPanel && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
            <div className="bg-white rounded-xl shadow p-6 text-center w-80">
              <div className="text-xl font-bold mb-1">{showPanel.title}</div>
              <div className="text-slate-600 mb-4">{showPanel.subtitle}</div>
              <button
                className="px-4 py-2 rounded bg-slate-900 text-white"
                onClick={handlePanelAction}
              >
                {showPanel.action} (Enter)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mt-4">
        <div className="text-center"><div className="text-slate-500 text-sm">Hits</div><div className="text-2xl font-bold">{hits}</div></div>
        <div className="text-center"><div className="text-slate-500 text-sm">Misses</div><div className="text-2xl font-bold">{misses}</div></div>
        <div className="text-center"><div className="text-slate-500 text-sm">Combo</div><div className="text-2xl font-bold">{combo} <span className="text-sm text-slate-500">best {bestCombo}</span></div></div>
        <div className="text-center"><div className="text-slate-500 text-sm">Score</div><div className="text-2xl font-bold">{score.toFixed(2)}</div></div>
      </div>
    </div>
  );
}

/* --------------------------- Main --------------------------- */
export default function SpeedRushArena() {
  const [name, setName] = useState<string>(() => localStorage.getItem("sra:name") || "Anonymous");
  useEffect(() => localStorage.setItem("sra:name", name), [name]);

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-6">
      <header className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold">SpeedRush Arena</h1>
          <p className="text-slate-500 text-sm">Reaction • CPS • Typing • Aim — Compete globally. {!supaReady() && <span className="text-amber-600">Leaderboard offline (env needed)</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name" className="border rounded px-3 py-2 w-44" />
        </div>
      </header>

      <AdSlot slotName="Top Banner Ad" width="100%" height="90px" />

      <div className="grid md:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <ReactionGame playerName={name} />
          <Leaderboard mode="reaction" title="Reaction — Global Top 10 (ms, lower is better)" />

          <CPSGame playerName={name} />
          <Leaderboard mode="cps" title="CPS — Global Top 10 (higher is better)" />

          <TypingGame playerName={name} />
          <Leaderboard mode="typing" title="Typing — Global Top 10 (WPM)" />

          <AimGame playerName={name} />
          <Leaderboard mode="aim" title="Aim — Global Top 10 (hits)" />
        </div>

        <div>
          <div className="border rounded-xl p-4">
            <div className="font-semibold">About</div>
            <div className="text-sm text-slate-600 mt-2 space-y-2">
              <p><strong>Reaction:</strong> Click as soon as it turns GO.</p>
              <p><strong>CPS:</strong> Click as fast as you can in 5s.</p>
              <p><strong>Typing:</strong> We compute true WPM; finish before reset.</p>
              <p><strong>Aim:</strong> Multiple ducks, difficulty, combo score, timer in scene.</p>
            </div>
          </div>

          <AdSlot slotName="Right Rail Ad" width="300px" height="250px" />
        </div>
      </div>

      <AdSlot slotName="Footer Banner Ad" width="100%" height="90px" />
    </main>
  );
}
