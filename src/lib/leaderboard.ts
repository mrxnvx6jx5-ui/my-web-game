// Leaderboard backed by Supabase, falling back to localStorage when the
// backend is unavailable (missing env, no table, offline, etc.).
//
// Expected Supabase table (run once in the SQL editor):
//
//   create table if not exists leaderboard (
//     id uuid primary key default gen_random_uuid(),
//     name text not null,
//     score integer not null,
//     worlds integer not null default 0,
//     bosses integer not null default 0,
//     created_at timestamptz not null default now()
//   );
//   alter table leaderboard enable row level security;
//   create policy "read all"   on leaderboard for select using (true);
//   create policy "insert all" on leaderboard for insert with check (true);

import { supabase } from './supabase'

export interface ScoreRow {
  name: string
  score: number
  worlds: number
  bosses: number
  created_at?: string
}

const LOCAL_KEY = 'cosmic-crusade-leaderboard-v1'
const hasBackend = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

function readLocal(): ScoreRow[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as ScoreRow[]
  } catch {
    return []
  }
}
function writeLocal(rows: ScoreRow[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 50)))
  } catch {
    /* ignore */
  }
}

export async function submitScore(row: ScoreRow): Promise<'supabase' | 'local'> {
  // Always keep a local copy too, so the player sees their run instantly.
  const local = readLocal()
  local.push({ ...row, created_at: new Date().toISOString() })
  local.sort((a, b) => b.score - a.score)
  writeLocal(local)

  if (hasBackend) {
    try {
      const { error } = await supabase.from('leaderboard').insert({
        name: row.name.slice(0, 24),
        score: row.score,
        worlds: row.worlds,
        bosses: row.bosses,
      })
      if (!error) return 'supabase'
    } catch {
      /* fall through to local */
    }
  }
  return 'local'
}

export async function fetchTop(limit = 10): Promise<{ rows: ScoreRow[]; source: 'supabase' | 'local' }> {
  if (hasBackend) {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('name, score, worlds, bosses, created_at')
        .order('score', { ascending: false })
        .limit(limit)
      if (!error && data) {
        return { rows: data as ScoreRow[], source: 'supabase' }
      }
    } catch {
      /* fall through to local */
    }
  }
  const local = readLocal().sort((a, b) => b.score - a.score).slice(0, limit)
  return { rows: local, source: 'local' }
}
