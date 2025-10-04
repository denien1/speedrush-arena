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

function AimGame({ playerName }: { playerName: string }) {
  /* ===== Sprite config — tweak for your sheet ===== */
  const SPRITE_URL = "/duck-sprite.png"; // your PNG sheet
  const FRAME_W = 64;                    // width of ONE frame (px)
  const FRAME_H = 48;                    // height of ONE frame (px)
  const FRAMES_ALIVE = 6;                // how many frames across for the flying row
  const ROW_ALIVE = 0;                   // row index for flying animation (0 = first row)
  const ROW_DEAD = 3;                    // row index for “shot/falling” pose

  /* ===== Game config ===== */
  type DiffKey = "easy" | "medium" | "hard";
  type DuckState = "alive" | "falling" | "dead";
  type Duck = {
    id: number;
    x: number; y: number;
    vx: number; vy: number;
    rot: number;
    state: DuckState;
    face: 1 | -1;
    deadAt?: number; // timestamp when landed, for respawn timer
  };

  const DUCK_W = FRAME_W;
  const DUCK_H = FRAME_H;
  const STRIP_W = FRAME_W * FRAMES_ALIVE;

  const DURATION = 15;
  const GRAVITY = 650;
  const RESPAWN_MS = 200; // delay after a duck lands before respawn

  const DIFF: Record<DiffKey, { ducks: number; speedMin: number; speedMax: number; mult: number }> = {
    easy:   { ducks: 4, speedMin: 70,  speedMax: 120, mult: 1.0 },
    medium: { ducks: 6, speedMin: 100, speedMax: 180, mult: 1.1 },
    hard:   { ducks: 9, speedMin: 150, speedMax: 230, mult: 1.25 },
  };

  /* ===== Background (gradient fallback; you can also add /forest.svg) ===== */
  const FOREST_BG = "linear-gradient(180deg,#cfe9ff 0%,#eaf7ff 70%)";
  const FOREST_IMG = "/forest.svg"; // optional; ignore if you don’t have it

  /* ===== Minimal inline strip as ultimate fallback ===== */
  const DUCK_STRIP_INLINE =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP_W}" height="${DUCK_H}" viewBox="0 0 ${STRIP_W} ${DUCK_H}">
  <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9c74f"/><stop offset="1" stop-color="#f8961e"/></linearGradient></defs>
  ${Array.from({length: FRAMES_ALIVE}, (_,i)=>`
    <g transform="translate(${i*DUCK_W},0)">
      <ellipse cx="38" cy="28" rx="20" ry="12" fill="url(#b)" stroke="#e99e23" stroke-width="1"/>
      <circle cx="20" cy="20" r="8.5" fill="#f9c74f" stroke="#e99e23" stroke-width="1"/>
      <circle cx="22.5" cy="18.5" r="1.8" fill="#222"/>
      <path d="M13 20 L7 18 L7 22 Z" fill="#f3722c"/>
    </g>`).join("")}
</svg>`);

  /* ===== State ===== */
  const [difficulty, setDifficulty] = React.useState<DiffKey>("medium");
  const [active, setActive] = React.useState(false);
  const [left, setLeft] = React.useState(DURATION);
  const [hits, setHits] = React.useState(0);
  const [misses, setMisses] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [combo, setCombo] = React.useState(0);
  const [bestCombo, setBestCombo] = React.useState(0);
  const [ducks, setDucks] = React.useState<Duck[]>([]);

  const arenaRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number>();
  const lastTsRef = React.useRef<number>(0);
  const submittedRef = React.useRef(false);

  /* ===== Tiny SFX ===== */
  const audioRef = React.useRef<AudioContext | null>(null);
  const ctx = () => (audioRef.current ??= new (window.AudioContext || (window as any).webkitAudioContext)());
  function beep(f:number, ms=90, v=0.15){ try{ const ac=ctx(); const o=ac.createOscillator(); const g=ac.createGain(); o.type="square"; o.frequency.value=f; g.gain.value=v; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>{o.stop(); o.disconnect(); g.disconnect();}, ms);}catch{} }
  const hitSfx = (p=0)=>beep(680+p,70,.18);
  const missSfx = ()=>beep(180,110,.10);
  const quackSfx = ()=>beep(520,70,.14);

  /* ===== Utils ===== */
  const rand = (a:number,b:number)=> a + Math.random()*(b-a);
  const measure = () => {
    const el = arenaRef.current; if (!el) return {w:0,h:0};
    return { w: el.clientWidth, h: el.clientHeight };
  };

  function makeDuck(id:number,w:number,h:number): Duck {
    const { speedMin, speedMax } = DIFF[difficulty];
    const x = rand(DUCK_W/2, Math.max(DUCK_W/2, w - DUCK_W/2));
    const y = rand(DUCK_H/2 + 8, Math.max(DUCK_H/2 + 8, h * 0.65));
    const sp = rand(speedMin, speedMax);
    const ang = rand(-Math.PI*0.35, Math.PI*0.35);
    const face: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    return { id, x, y, vx: Math.cos(ang)*sp*face, vy: Math.sin(ang)*sp*0.35, rot: 0, state: "alive", face };
  }

  /* Spawn (after layout) */
  function spawn(retry=0) {
    const { w, h } = measure();
    if (w < DUCK_W*2 || h < DUCK_H*2) {
      if (retry > 10) {
        const N = DIFF[difficulty].ducks;
        setDucks(Array.from({length:N},(_,i)=>makeDuck(i+1,600,260)));
        return;
      }
      requestAnimationFrame(()=>spawn(retry+1));
      return;
    }
    const N = DIFF[difficulty].ducks;
    setDucks(Array.from({length:N},(_,i)=>makeDuck(i+1,w,h)));
  }

  /* Animation */
  const tick = (ts:number) => {
    if (!active) return;
    if (!lastTsRef.current) lastTsRef.current = ts;
    const dt = Math.max(0, Math.min((ts - lastTsRef.current)/1000, 0.05));
    lastTsRef.current = ts;

    const { w, h } = measure();
    const W = w || 600, H = h || 260, groundY = H - DUCK_H/2;

    setDucks(prev => prev.map(d => {
      let {x,y,vx,vy,rot,state,face,deadAt} = d;

      if (state === "alive") {
        x += vx*dt; y += vy*dt;
        if (x <= DUCK_W/2)        { x = DUCK_W/2;          vx = Math.abs(vx);  face = 1; }
        if (x >= W - DUCK_W/2)    { x = W - DUCK_W/2;      vx = -Math.abs(vx); face = -1; }
        if (y <= DUCK_H/2)        { y = DUCK_H/2;          vy = Math.abs(vy)*0.6; }
        if (y >= H*0.7)           { y = H*0.7;             vy = -Math.abs(vy)*0.6; }

      } else if (state === "falling") {
        vy += GRAVITY*dt; y += vy*dt; rot += 360*dt*.8;
        if (y >= groundY) { y = groundY; vy = 0; vx = 0; state = "dead"; deadAt = performance.now(); }
      } else if (state === "dead") {
        // respawn after short delay
        if (deadAt && performance.now() - deadAt >= RESPAWN_MS && active) {
          const { w, h } = measure();
          return makeDuck(d.id, w || 600, h || 260);
        }
      }

      return { ...d, x, y, vx, vy, rot, state, face, deadAt };
    }));

    rafRef.current = requestAnimationFrame(tick);
  };

  /* Start/stop RAF on active */
  React.useEffect(() => {
    if (!active) return;
    lastTsRef.current = 0;
    cancelAnimationFrame(rafRef.current!);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current!);
  }, [active]);

  /* Timer + cleanup */
  React.useEffect(() => {
    if (!active) return;
    if (left <= 0) { finish(); return; }
    const t = setTimeout(() => setLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [active, left]);

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current!), []);
  React.useEffect(() => { if (!active) spawn(0); }, [difficulty]);

  /* Controls */
  function start() {
    setHits(0); setMisses(0); setScore(0); setCombo(0); setBestCombo(0);
    setLeft(DURATION); setActive(true); submittedRef.current = false;
    lastTsRef.current = 0;
    requestAnimationFrame(()=>requestAnimationFrame(()=>spawn(0)));
  }
  async function finish() {
    if (submittedRef.current) return;
    const value = Number(hits.toFixed(2));
    if (value > 0) await submitIfValid(playerName, "aim", value);
    submittedRef.current = true;
    setActive(false);
  }

  function onArenaClick() {
    if (!active) return;
    setMisses(m=>m+1); setCombo(0); missSfx();
  }
  function onDuckClick(e:React.MouseEvent,id:number) {
    e.stopPropagation(); if (!active) return;
    setDucks(prev => prev.map(d => d.id===id && d.state==="alive" ? { ...d, state:"falling", vy:-140 } : d));
    setHits(h=>h+1);
    setCombo(c=>{
      const next=c+1; setBestCombo(b=>Math.max(b,next));
      const mult=DIFF[difficulty].mult; const comboBonus=1+next*0.10;
      setScore(s=>Number((s + 1*mult*comboBonus).toFixed(2)));
      hitSfx(Math.min(300,next*18)); quackSfx();
      return next;
    });
  }

  /* UI */
  return (
    <div className="border rounded-2xl p-4">
      <style>{`
        @keyframes duckFlap { from{background-position:0 -${ROW_ALIVE*FRAME_H}px;} to{background-position:-${STRIP_W}px -${ROW_ALIVE*FRAME_H}px;} }
        .duck-anim { animation: duckFlap .42s steps(${FRAMES_ALIVE}) infinite; }
        .duck-stop { animation: none !important; }
      `}</style>

      <div className="font-semibold">Aim Trainer (15s)</div>
      <div className="text-sm text-slate-500 mb-3">Choose difficulty. Score scales with difficulty & combo streak.</div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-slate-600 mr-1">Difficulty:</span>
        {(["easy","medium","hard"] as DiffKey[]).map(k=>(
          <button key={k}
            className={`px-3 py-1 rounded ${difficulty===k?"bg-slate-900 text-white":"bg-slate-100"}`}
            onClick={()=>!active && setDifficulty(k)}
            disabled={active}
            title={`×${DIFF[k].mult}`}>
            {k[0].toUpperCase()+k.slice(1)} (×{DIFF[k].mult})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button className="px-3 py-1 rounded bg-slate-900 text-white disabled:opacity-50" onClick={start} disabled={active}>
            {active ? "Running..." : "Start"}
          </button>
          <div className="text-sm text-slate-600">Time left: {left}s</div>
        </div>
      </div>

      {/* Arena */}
      <div
        ref={arenaRef}
        onClick={onArenaClick}
        className="relative h-64 rounded-2xl overflow-hidden select-none"
        style={{
          background: FOREST_BG,
          backgroundImage: `url(${FOREST_IMG}), ${FOREST_BG}`,
          backgroundSize: "cover, cover",
          backgroundPosition: "center, center"
        }}
      >
        {active && (
          <div className="absolute top-2 right-2 bg-white/90 text-slate-900 text-xs font-semibold px-2 py-1 rounded-md z-[1]">
            {left}s
          </div>
        )}
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center z-[1]">
            <button onClick={start} className="px-4 py-2 rounded bg-white shadow">Start</button>
          </div>
        )}

        {/* Ducks */}
        {ducks.map(d=>{
          const falling = d.state !== "alive";
          const rowY = (falling ? ROW_DEAD : ROW_ALIVE) * FRAME_H;
          return (
            <button
              key={d.id}
              aria-label={`duck-${d.id}`}
              onClick={(e)=>onDuckClick(e,d.id)}
              className={`absolute ${falling ? "duck-stop" : "duck-anim"}`}
              style={{
                left: 0, top: 0,
                width: DUCK_W, height: DUCK_H,
                zIndex: 2, display: "block",
                transform: `translate3d(${d.x - DUCK_W/2}px, ${d.y - DUCK_H/2}px, 0) scaleX(${d.face}) rotate(${d.rot}deg)`,
                transformOrigin: "center",
                // Try your sprite sheet first, then inline fallback
                backgroundImage: `url(${SPRITE_URL}), url(${DUCK_STRIP_INLINE})`,
                // First layer is row strip (FRAMES_ALIVE * FRAME_W by FRAME_H), second is inline strip
                backgroundSize: `${STRIP_W}px ${FRAME_H}px, ${STRIP_W}px ${FRAME_H}px`,
                backgroundRepeat: "no-repeat, no-repeat",
                // Y offset selects the row. For the inline fallback (single row), Y=0 is fine.
                backgroundPosition: `0px -${rowY}px, 0px 0px`,
                backgroundColor: "#f59e0b20",
              }}
              title="quack!"
            />
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-4 mt-4">
        <div className="rounded-xl bg-slate-100 p-4 text-center"><div className="text-slate-500 text-sm">Hits</div><div className="text-2xl font-bold">{hits}</div></div>
        <div className="rounded-xl bg-slate-100 p-4 text-center"><div className="text-slate-500 text-sm">Misses</div><div className="text-2xl font-bold">{misses}</div></div>
        <div className="rounded-xl bg-slate-100 p-4 text-center"><div className="text-slate-500 text-sm">Combo</div><div className="text-2xl font-bold">{combo} <span className="text-sm text-slate-500">best {bestCombo}</span></div></div>
        <div className="rounded-xl bg-slate-100 p-4 text-center"><div className="text-slate-500 text-sm">Score</div><div className="text-2xl font-bold">{score.toFixed(2)}</div></div>
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
