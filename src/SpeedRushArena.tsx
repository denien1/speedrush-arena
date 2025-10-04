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
  /* ------------ SPRITE CONFIG (matches your sheet) ------------- */
  const SPRITE_URL = "/duck-sprite.png";     // your sheet in /public
  const COLS = 6;                            // frames across
  const FRAME_W = 64;                        // single frame width  (adjust if needed)
  const FRAME_H = 64;                        // single frame height (adjust if needed)
  const FLY_FRAMES = 4;                      // 0..3 flap
  const SHOT_COL = 4;                        // shot/falling pose
  const DEAD_COL = 5;                        // dead on ground

  /* ------------ BACKGROUND (uses your forest image) ------------- */
  const BG_URL = "/forest-bg.png";           // in /public
  const SKY_GRADIENT = ["#cfe9ff", "#eaf7ff"]; // sky fallback/overlay

  /* ------------------------- GAME CONFIG ------------------------ */
  type DiffKey = "easy" | "medium" | "hard";
  type DuckState = "alive" | "falling" | "dead";
  type Duck = {
    id: number;
    x: number; y: number;
    vx: number; vy: number;
    rot: number;
    state: DuckState;
    face: 1 | -1;
    row: number;          // sprite row (color)
    deadAt?: number;
  };

  const GRAVITY = 700;
  const DURATION = 15;
  const RESPAWN_MS = 180;

  const DIFF: Record<DiffKey, { ducks: number; speedMin: number; speedMax: number; mult: number }> = {
    easy:   { ducks: 4, speedMin: 70,  speedMax: 120, mult: 1.0 },
    medium: { ducks: 6, speedMin: 100, speedMax: 180, mult: 1.1 },
    hard:   { ducks: 9, speedMin: 150, speedMax: 240, mult: 1.25 },
  };

  /* --------------------------- STATE ---------------------------- */
  const [difficulty, setDifficulty] = React.useState<DiffKey>("medium");
  const [active, setActive] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState(DURATION);
  const [hits, setHits] = React.useState(0);
  const [misses, setMisses] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [combo, setCombo] = React.useState(0);
  const [bestCombo, setBestCombo] = React.useState(0);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number>();
  const lastTsRef = React.useRef<number>(0);
  const ducksRef = React.useRef<Duck[]>([]);
  const submittedRef = React.useRef(false);

  // graphics
  const bgImgRef = React.useRef<HTMLImageElement | null>(null);
  const spriteRawRef = React.useRef<HTMLImageElement | null>(null);
  const spriteKeyedRef = React.useRef<HTMLCanvasElement | null>(null); // chroma-keyed version
  const rowsRef = React.useRef<number>(1);

  // bg scroll
  const bgScrollRef = React.useRef(0);

  /* --------------------------- SFX ------------------------------ */
  const audioRef = React.useRef<AudioContext | null>(null);
  const ctx = () => (audioRef.current ??= new (window.AudioContext || (window as any).webkitAudioContext)());
  function beep(f:number, ms=90, v=0.12){ try{ const ac=ctx(); const o=ac.createOscillator(); const g=ac.createGain(); o.type="square"; o.frequency.value=f; g.gain.value=v; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>{o.stop(); o.disconnect(); g.disconnect();}, ms);}catch{} }
  const sfxHit = (p=0)=>beep(680+p,70,.16);
  const sfxMiss = ()=>beep(180,110,.10);
  const sfxQuack = ()=>beep(520,70,.14);

  /* --------------------- LOAD IMAGES (ONCE) --------------------- */
  React.useEffect(() => {
    // BG
    const bg = new Image();
    bg.src = BG_URL;
    bg.onload = () => { bgImgRef.current = bg; };

    // sprite (raw)
    const spr = new Image();
    spr.src = SPRITE_URL;
    spr.onload = () => {
      spriteRawRef.current = spr;
      // derive rows
      rowsRef.current = Math.max(1, Math.floor(spr.height / FRAME_H));
      // chroma-key the sprite once -> cached canvas
      spriteKeyedRef.current = chromaKeySprite(spr, {key:[235,235,235], tol:30}); // remove near-white bg
      // after assets ready, ensure we have ducks and a render
      spawnDucks();
      draw(0); 
    };
  }, []);

  /* --------------- CANVAS SIZE (DPR + container fit) ----------- */
  function fitCanvas() {
    const el = canvasRef.current, box = containerRef.current;
    if (!el || !box) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = box.clientWidth;
    const h = Math.max(256, Math.round(w * 0.38)); // nice ratio
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    const g = el.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false; // pixel-art crisp
  }

  React.useEffect(() => {
    fitCanvas();
    const r = new ResizeObserver(() => fitCanvas());
    if (containerRef.current) r.observe(containerRef.current);
    return () => r.disconnect();
  }, []);

  /* ----------------------- SPAWN / UTILS ----------------------- */
  const rand = (a:number,b:number)=>a+Math.random()*(b-a);

  function arenaSize() {
    const el = canvasRef.current;
    if (!el) return {w:600,h:260};
    return { w: el.clientWidth, h: el.clientHeight };
  }

  function makeDuck(id:number): Duck {
    const {w,h} = arenaSize();
    const { speedMin, speedMax } = DIFF[difficulty];
    const x = rand(FRAME_W/2, Math.max(FRAME_W/2, w - FRAME_W/2));
    const y = rand(FRAME_H/2 + 8, Math.max(FRAME_H/2 + 8, h * 0.68));
    const sp = rand(speedMin, speedMax);
    const ang = rand(-Math.PI*0.35, Math.PI*0.35);
    const face: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const row = Math.floor(Math.random()*rowsRef.current);
    return { id, x, y, vx: Math.cos(ang)*sp*face, vy: Math.sin(ang)*sp*0.35, rot: 0, state:"alive", face, row };
  }

  function spawnDucks() {
    const n = DIFF[difficulty].ducks;
    ducksRef.current = Array.from({length:n}, (_,i)=>makeDuck(i+1));
  }

  /* ----------------------- GAME LOOP --------------------------- */
  function start() {
    setHits(0); setMisses(0); setScore(0); setCombo(0); setBestCombo(0);
    setTimeLeft(DURATION); setActive(true); submittedRef.current = false;
    lastTsRef.current = 0;
    spawnDucks();
    cancelAnimationFrame(rafRef.current!);
    rafRef.current = requestAnimationFrame(step);
  }

  async function finish() {
    if (submittedRef.current) return;
    const value = Number(hits.toFixed(2));
    if (value > 0) await submitIfValid(playerName, "aim", value);
    submittedRef.current = true;
    setActive(false);
  }

  React.useEffect(() => {
    if (!active) return;
    if (timeLeft <= 0) { finish(); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [active, timeLeft]);

  function step(ts:number) {
    if (!active) return;
    if (!lastTsRef.current) lastTsRef.current = ts;
    const dt = Math.max(0, Math.min((ts - lastTsRef.current)/1000, 0.05));
    lastTsRef.current = ts;

    // move/physics
    const {w,h} = arenaSize();
    const ground = h - FRAME_H/2;

    ducksRef.current = ducksRef.current.map(d => {
      let {x,y,vx,vy,rot,state,face,row,deadAt} = d;

      if (state === "alive") {
        x += vx*dt; y += vy*dt;
        if (x <= FRAME_W/2)          { x = FRAME_W/2;          vx = Math.abs(vx);  face = 1; }
        if (x >= w - FRAME_W/2)      { x = w - FRAME_W/2;      vx = -Math.abs(vx); face = -1; }
        if (y <= FRAME_H/2)          { y = FRAME_H/2;          vy = Math.abs(vy)*0.6; }
        if (y >= h*0.7)              { y = h*0.7;              vy = -Math.abs(vy)*0.6; }
      } else if (state === "falling") {
        vy += GRAVITY*dt;
        y  += vy*dt;
        rot += 360*dt*.8;
        if (y >= ground) { y = ground; vy = 0; vx = 0; state = "dead"; deadAt = performance.now(); }
      } else if (state === "dead") {
        if (deadAt && performance.now() - deadAt >= RESPAWN_MS && active) {
          return makeDuck(d.id); // respawn
        }
      }
      return { ...d, x,y,vx,vy,rot,state,face,row,deadAt };
    });

    // bg scroll
    bgScrollRef.current = (bgScrollRef.current + dt*60) % 800;

    draw(dt);
    rafRef.current = requestAnimationFrame(step);
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (!active) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // topmost first
    for (let i = ducksRef.current.length - 1; i >= 0; i--) {
      const d = ducksRef.current[i];
      if (d.state !== "alive") continue;
      // hit test (circle)
      const dx = px - d.x;
      const dy = py - d.y;
      const r = Math.min(FRAME_W, FRAME_H)*0.45;
      if (dx*dx + dy*dy <= r*r) {
        // hit!
        ducksRef.current[i] = { ...d, state:"falling", vy:-160 };
        setHits(h => h+1);
        setCombo(c => {
          const next = c+1;
          setBestCombo(b => Math.max(b,next));
          const mult = DIFF[difficulty].mult;
          const bonus = 1 + next*0.10;
          setScore(s => Number((s + 1*mult*bonus).toFixed(2)));
          sfxHit(Math.min(300,next*18));
          sfxQuack();
          return next;
        });
        draw(0);
        return; // don’t count miss
      }
    }

    // miss
    setMisses(m => m+1);
    setCombo(0);
    sfxMiss();
  }

  /* --------------------- RENDERING (CANVAS) -------------------- */
  function draw(_dt:number) {
    const c = canvasRef.current; if (!c) return;
    const g = c.getContext("2d")!;

    const w = c.clientWidth;
    const h = c.clientHeight;

    // sky gradient
    const grad = g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0, SKY_GRADIENT[0]);
    grad.addColorStop(1, SKY_GRADIENT[1]);
    g.fillStyle = grad;
    g.fillRect(0,0,w,h);

    // forest background (looping)
    const bg = bgImgRef.current;
    if (bg && bg.complete) {
      const bw = 800; // tile width
      const bh = Math.min(h, Math.round(bg.height * (w / bg.width))); // scale to fit width nicely
      const y = Math.round(h - bh);
      const x = -Math.floor(bgScrollRef.current % bw);
      g.drawImage(bg, x, y, bw, bh);
      g.drawImage(bg, x + bw, y, bw, bh);
    }

    // ducks
    const spr = spriteKeyedRef.current || spriteCanvasFallback(spriteRawRef.current);
    if (spr) {
      ducksRef.current.forEach(d => {
        const sx = d.state === "alive"
          ? Math.floor((performance.now()/120) % FLY_FRAMES) * FRAME_W
          : (d.state === "falling" ? SHOT_COL * FRAME_W : DEAD_COL * FRAME_W);
        const sy = d.row * FRAME_H;

        g.save();
        g.translate(d.x, d.y);
        g.scale(d.face, 1);
        g.rotate(d.rot * Math.PI/180);
        g.imageSmoothingEnabled = false;
        g.drawImage(
          spr,
          sx, sy, FRAME_W, FRAME_H,
          -FRAME_W/2, -FRAME_H/2, FRAME_W, FRAME_H
        );
        g.restore();
      });
    }
  }

  /* ----------- CHROMA-KEY (strip near-white background) -------- */
  function chromaKeySprite(img: HTMLImageElement, opt:{key:[number,number,number], tol:number}) {
    const {key:[kr,kg,kb], tol} = opt;
    const w = img.width, h = img.height;
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const g = off.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0,0,w,h);
    const p = data.data;
    for (let i=0;i<p.length;i+=4) {
      const r=p[i], g1=p[i+1], b=p[i+2];
      if (Math.abs(r-kr)<=tol && Math.abs(g1-kg)<=tol && Math.abs(b-kb)<=tol) {
        p[i+3] = 0; // make transparent
      }
    }
    g.putImageData(data,0,0);
    return off;
  }

  function spriteCanvasFallback(img: HTMLImageElement | null) {
    if (!img) return null;
    const cvs = document.createElement("canvas");
    cvs.width = img.width; cvs.height = img.height;
    const g = cvs.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.drawImage(img,0,0);
    return cvs;
  }

  /* --------------------------- UI ------------------------------ */
  return (
    <div className="border rounded-2xl p-4">
      <div className="font-semibold">Aim Trainer (15s)</div>
      <div className="text-sm text-slate-500 mb-3">
        Choose difficulty. Score scales with difficulty & combo streak.
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-slate-600 mr-1">Difficulty:</span>
        {(["easy","medium","hard"] as DiffKey[]).map(k => (
          <button
            key={k}
            className={`px-3 py-1 rounded ${difficulty===k?"bg-slate-900 text-white":"bg-slate-100"}`}
            onClick={()=>!active && setDifficulty(k)}
            disabled={active}
            title={`×${DIFF[k].mult}`}
          >
            {k[0].toUpperCase()+k.slice(1)} (×{DIFF[k].mult})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            className="px-3 py-1 rounded bg-slate-900 text-white disabled:opacity-50"
            onClick={start}
            disabled={active}
          >
            {active ? "Running..." : "Start"}
          </button>
          <div className="text-sm text-slate-600">Time left: {timeLeft}s</div>
        </div>
      </div>

      <div ref={containerRef} className="relative h-64 rounded-2xl overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          className="absolute inset-0 block w-full h-full cursor-crosshair"
        />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="px-4 py-2 rounded bg-white shadow text-slate-900">Start</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4 mt-4">
        <div className="rounded-xl bg-slate-100 p-4 text-center">
          <div className="text-slate-500 text-sm">Hits</div>
          <div className="text-2xl font-bold">{hits}</div>
        </div>
        <div className="rounded-xl bg-slate-100 p-4 text-center">
          <div className="text-slate-500 text-sm">Misses</div>
          <div className="text-2xl font-bold">{misses}</div>
        </div>
        <div className="rounded-xl bg-slate-100 p-4 text-center">
          <div className="text-slate-500 text-sm">Combo</div>
          <div className="text-2xl font-bold">{combo} <span className="text-sm text-slate-500">best {bestCombo}</span></div>
        </div>
        <div className="rounded-xl bg-slate-100 p-4 text-center">
          <div className="text-slate-500 text-sm">Score</div>
          <div className="text-2xl font-bold">{score.toFixed(2)}</div>
        </div>
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
