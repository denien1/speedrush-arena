import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = (url && key) ? createClient(url, key, {
  auth: { persistSession: false },
}) : null

export function supaReady(){
  return Boolean(supabase)
}

export type ModeKey = 'reaction' | 'cps' | 'typing' | 'aim'

export async function submitScore(name: string, mode: ModeKey, value: number){
  if(!supabase) return { error: 'no-supabase' }
  const { error } = await supabase.from('scores').insert({ name, mode, value })
  return { error }
}

export async function fetchTop(mode: ModeKey, limit = 10){
  if(!supabase) return { data: [] as any[], error: 'no-supabase' }
  const order = mode === 'reaction' ? { column: 'value', ascending: true } : { column: 'value', ascending: false }
  const { data, error } = await supabase
    .from('scores')
    .select('id,created_at,name,mode,value')
    .eq('mode', mode)
    .order(order.column as any, { ascending: order.ascending })
    .limit(limit)
  return { data: data || [], error }
}

export async function submitIfValid(name: string, mode: ModeKey, value: number) {
  const v = Number.isFinite(value) ? Number(value) : 0
  if (!supaReady() || v <= 0) return { skipped: true }
  return submitScore(name?.trim() || "Anonymous", mode, v)
}

// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export type ModeKey = "reaction" | "cps" | "typing" | "aim";

export async function submitScore(name: string, mode: ModeKey, value: number) {
  if (!supabase) return { error: "no-supabase" };
  const { error } = await supabase.from("scores").insert({ name, mode, value });
  return { error };
}

export async function fetchTop(mode: ModeKey, limit = 10) {
  if (!supabase) return { data: [] as any[], error: "no-supabase" };
  const order =
    mode === "reaction"
      ? { column: "value", ascending: true } // lower is better (ms)
      : { column: "value", ascending: false }; // higher is better
  const { data, error } = await supabase
    .from("scores")
    .select("id,created_at,name,mode,value")
    .eq("mode", mode)
    .order(order.column as any, { ascending: order.ascending })
    .limit(limit);
  return { data: data || [], error };
}

// 🔹 Exported helper that your Aim/Typing code imports
export async function submitIfValid(name: string, mode: ModeKey, value: number) {
  const v = Number.isFinite(value) ? Number(value) : 0;
  if (!supabase || v <= 0) return { skipped: true as const };
  return submitScore(name?.trim() || "Anonymous", mode, v);
}

export function supaReady() {
  return Boolean(supabase);
}
