import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import AdSlot from "@/components/ui/AdSlot";
import { smartShare } from "@/lib/share";
import {
  fetchTop,
  submitScore,
  submitIfValid,
  supaReady,
  type ModeKey,
} from "@/lib/supabase";

/* ----------------------------------------------------------------------------
   Utility
---------------------------------------------------------------------------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function msNow() {
  return Date.now();
}

/* ----------------------------------------------------------------------------
   Leaderboard widget
---------------------------------------------------------------------------- */

function Leaderboard({
  mode,
  title,
}: {
  mode: ModeKey;
  title: string;
}) {
  const [rows, setRows] = useState<Array<{ id: number; name: string; value: number }>>([]);

  async function refresh() {
    const { data } = await fetchTop(mode, 10);
    setRows((data as any[])?.map((r) => ({ id: r.id, name: r.name, value: r.value })) || []);
  }

  useEffect(() => {
    refresh();
  }, [mode]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-sm text-slate-500">No scores yet. Be the first!</div>
        ) : (
          <ol className="space-y-2 list-decimal pl-5">
            {rows.map((r, i) => (
              <li key={r.id} className="flex justify-between gap-4">
                <span className="truncate">
                  {r.name} —{" "}
                  {mode === "typing"
                    ? `${r.value.toFixed(2)} WPM`
                    : mode === "aim"
                    ? `${r.value.toFixed(2)} hits`
                    : mode === "reaction"
                    ? `${r.value.toFixed(2)} ms`
                    : `${r.value.toFixed(2)} CPS`}
                </span>
                <span className="tabular-nums text-slate-700">
                  {mode === "reaction" ? r.value.toFixed(2) + " ms" : r.value.toFixed(2)}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-3">
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
   Main component
---------------------------------------------------------------------------- */

export default function SpeedRushArena() {
  const [name, setName] = useState<string>(() => localStorage.getItem("sra:name") || "Anonymous");
  useEffect(() => localStorage.setItem("sra:name", name), [name]);

  const canSave = supaReady();

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-6">
      <header className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold">SpeedRush Arena</h1>
          <p className="text-slate-500 text-sm">
            Reaction • CPS • Typing • Aim — Compete globally.{" "}
            {!canSave && <span className="text-amber-600">Leaderboard offline (missing env)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-44"
          />
          <Button
            variant="secondary"
            onClick={async () => {
              await smartShare({
                title: "SpeedRush Arena",
                text: "Play SpeedRush Arena and climb the global leaderboard!",
              });
            }}
          >
            Share
          </Button>
        </div>
      </header>

      <AdSlot slotName="Top Banner Ad" width="100%" height="90px" />

      <Tabs defaultValue="reaction" className="grid md:grid-cols-[1fr_360px] gap-6">
        {/* Left: Games */}
        <div>
          <TabsList className="grid grid-cols-4 w-full mb-4">
            <TabsTrigger value="reaction">Reaction</TabsTrigger>
            <TabsTrigger value="cps">CPS</TabsTrigger>
            <TabsTrigger value="typing">Typing</TabsTrigger>
            <TabsTrigger value="aim">Aim</TabsTrigger>
          </TabsList>

          <TabsContent value="reaction">
            <ReactionGame playerName={name} />
            <Leaderboard mode="reaction" title="Reaction — Global Top 10 (ms, lower is better)" />
          </TabsContent>

          <TabsContent value="cps">
            <CPSGame playerName={name} />
            <Leaderboard mode="cps" title="CPS — Global Top 10 (higher is better)" />
          </TabsContent>

          <TabsContent value="typing">
            <TypingGame playerName={name} />
            <Leaderboard mode="typing" title="Typing — Global Top 10 (WPM)" />
          </TabsContent>

          <TabsContent value="aim">
            <AimGame playerName={name} />
            <Leaderboard mode="aim" title="Aim — Global Top 10 (hits)" />
          </TabsContent>
        </div>

        {/* Right: Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>
                Play quick tests and submit your score to the global leaderboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-2">
              <p>
                <strong>Reaction:</strong> Click as soon as the screen turns ready.
              </p>
              <p>
                <strong>CPS:</strong> Click as fast as you can in 5 seconds.
              </p>
              <p>
                <strong>Typing:</strong> Type the prompt accurately; we calculate true WPM.
              </p>
              <p>
                <strong>Aim:</strong> Hit as many targets as possible within 15 seconds.
              </p>
            </CardContent>
          </Card>

          <AdSlot slotName="Right Rail Ad" width="300px" height="250px" />
        </div>
      </Tabs>

      <AdSlot slotName="Footer Banner Ad" width="100%" height="90px" />
    </main>
  );
}

/* ----------------------------------------------------------------------------
   Reaction Game
---------------------------------------------------------------------------- */

function ReactionGame({ playerName }: { playerName: string }) {
  const [state, setState] = useState<"idle" | "waiting" | "go" | "done">("idle");
  const [resultMs, setResultMs] = useState<number>(0);
  const startRef = useRef<number>(0);
  const timeoutRef = useRef<any>();

  function reset() {
    setState("idle");
    setResultMs(0);
    clearTimeout(timeoutRef.current);
  }

  function start() {
    reset();
    setState("waiting");
    timeoutRef.current = setTimeout(() => {
      startRef.current = msNow();
      setState("go");
    }, 600 + Math.random() * 1200);
  }

  async function click() {
    if (state === "go") {
      const ms = msNow() - startRef.current;
      setResultMs(ms);
      setState("done");
      await submitIfValid(playerName, "reaction", Number(ms.toFixed(2)));
    } else if (state === "waiting") {
      // too early
      reset();
    } else {
      start();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reaction Test</CardTitle>
        <CardDescription>Click when it turns “GO”. Lower is better.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onClick={click}
          className={`h-40 rounded-2xl flex items-center justify-center text-xl font-bold cursor-pointer select-none ${
            state === "go" ? "bg-green-500 text-white" : "bg-slate-100"
          }`}
        >
          {state === "idle" && "Click to Start"}
          {state === "waiting" && "Wait..."}
          {state === "go" && "GO!"}
          {state === "done" && `${resultMs.toFixed(2)} ms (Click to try again)`}
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
   CPS Game (Clicks Per Second)
---------------------------------------------------------------------------- */

function CPSGame({ playerName }: { playerName: string }) {
  const DURATION = 5; // seconds
  const [count, setCount] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [active, setActive] = useState(false);
  const startRef = useRef<number>(0);

  function start() {
    setCount(0);
    setLeft(DURATION);
    setActive(true);
    startRef.current = msNow();
  }

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
    <Card>
      <CardHeader>
        <CardTitle>CPS Test (5s)</CardTitle>
        <CardDescription>Click as fast as you can for 5 seconds.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <Button onClick={start} disabled={active}>
            {active ? "Running…" : "Start"}
          </Button>
          <div className="text-sm text-slate-600">Time left: {left}s</div>
        </div>
        <div
          onClick={() => active && setCount((c) => c + 1)}
            className="h-40 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl font-bold select-none cursor-pointer"
        >
          {count} clicks
        </div>
        <div className="mt-3">
          <Progress value={((DURATION - left) / DURATION) * 100} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
   Typing Game — WPM FIXED
---------------------------------------------------------------------------- */

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
    setActive(true);
    setLeft(DURATION);
    setTyped("");
    setCorrectChars(0);
    setStartMs(msNow());
    submittedRef.current = false;
  }

  // compute correctness as you type
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setTyped(text);
    const upto = TYPING_TEXT.slice(0, text.length);
    let ok = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === upto[i]) ok++;
    }
    setCorrectChars(ok);
  }

  // finish + submit (BEFORE resets)
  async function finish() {
    if (submittedRef.current) return;
    const elapsedSec = Math.max(0.001, (msNow() - startMs) / 1000);
    const words = correctChars / 5;
    const wpm = words / (elapsedSec / 60);
    const wpmRounded = Number.isFinite(wpm) ? Number(wpm.toFixed(2)) : 0;

    if (wpmRounded > 0) {
      await submitIfValid(playerName, "typing", wpmRounded);
      submittedRef.current = true;
    }
    setActive(false);
  }

  // timer
  useEffect(() => {
    if (!active) return;
    if (left <= 0) {
      finish();
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [active, left]);

  const accuracy = typed.length ? (correctChars / typed.length) * 100 : 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Typing Sprint (30s)</CardTitle>
        <CardDescription>Type accurately; score is true WPM (5 chars = 1 word).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-slate-600 mb-2">Time left: {left}s</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm mb-2">
          {TYPING_TEXT}
        </div>
        <Input
          value={typed}
          onChange={onChange}
          placeholder="Start typing to begin…"
          disabled={!active}
          className="mb-3"
        />
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-slate-500">Chars correct</div>
            <div className="font-semibold">{correctChars}</div>
          </div>
          <div>
            <div className="text-slate-500">Accuracy</div>
            <div className="font-semibold">{accuracy.toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-slate-500">Live WPM</div>
            <div className="font-semibold">
              {(() => {
                const sec = Math.max(0.001, (msNow() - startMs) / 1000);
                const words = correctChars / 5;
                const wpm = words / (sec / 60);
                return Number.isFinite(wpm) ? wpm.toFixed(2) : "0.00";
              })()}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={start} disabled={active}>
            {active ? "Running…" : "Start"}
          </Button>
          <Button variant="secondary" onClick={finish} disabled={!active}>
            Finish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
   Aim Game — HITS FIXED
---------------------------------------------------------------------------- */

function AimGame({ playerName }: { playerName: string }) {
  const DURATION = 15;
  const [active, setActive] = useState(false);
  const [left, setLeft] = useState(DURATION);
  const [hits, setHits] = useState(0);
  const [target, setTarget] = useState<{ x: number; y: number }>(() => ({ x: 50, y: 50 }));
  const submittedRef = useRef(false);

  function randomPos() {
    const pad = 10;
    const x = pad + Math.random() * (100 - pad * 2);
    const y = pad + Math.random() * (100 - pad * 2);
    setTarget({ x, y });
  }

  function start() {
    setActive(true);
    setLeft(DURATION);
    setHits(0);
    randomPos();
    submittedRef.current = false;
  }

  async function finish() {
    if (submittedRef.current) return;
    // Submit HITS (before reset)
    const value = Number(hits.toFixed(2));
    if (value > 0) {
      await submitIfValid(playerName, "aim", value);
      submittedRef.current = true;
    }
    setActive(false);
  }

  // timer
  useEffect(() => {
    if (!active) return;
    if (left <= 0) {
      finish();
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [active, left, hits]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aim Trainer (15s)</CardTitle>
        <CardDescription>Click the target as many times as you can.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <Button onClick={start} disabled={active}>
            {active ? "Running…" : "Start"}
          </Button>
          <div className="text-sm text-slate-600">Time left: {left}s</div>
          <div className="text-sm text-slate-600">Hits: {hits}</div>
        </div>

        <div className="relative h-64 rounded-2xl bg-slate-100 overflow-hidden">
          {/* target */}
          <button
            aria-label="target"
            onClick={() => {
              if (!active) return;
              setHits((h) => h + 1);
              randomPos();
            }}
            className="absolute h-8 w-8 rounded-full bg-rose-500 shadow"
            style={{ left: `${target.x}%`, top: `${target.y}%`, transform: "translate(-50%, -50%)" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
   submitIfValid helper (if you didn't paste it into supabase.ts yet)
   If it's already there, you can remove this block.
---------------------------------------------------------------------------- */

// NOTE: If you already added this in "@/lib/supabase", delete this local copy.
export async function submitIfValid(name: string, mode: ModeKey, value: number) {
  const v = Number.isFinite(value) ? Number(value) : 0;
  if (!supaReady() || v <= 0) return { skipped: true as const };
  return submitScore(name?.trim() || "Anonymous", mode, v);
}
