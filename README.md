# Cosmic Crusade

A retro top-down space shooter with a story-mode campaign, built with React + TypeScript + Vite. Blast aliens, collect space gems, topple bosses, and save the galaxy across 10 sectors — with affectionate nods to *Star Trek* and *Star Wars*.

## Gameplay

- **10 sectors (worlds)**, each with **4 bosses**. Each boss is guarded by **3 levels** you clear before the boss fight.
- **Defeat 2 of a sector's 4 bosses** to unlock the next sector.
- **Shields.** You start every level with full shields that absorb hits before you lose a life. Some gems drop **shield recharge cells**, and a rare Med-Kit grants an extra life.
- **3 lives.** When they run out, it's game over and your run is recorded on the leaderboard.
- **Asteroids** drift through tougher sectors (and all Intense/Insane runs) — shoot them for points or dodge them; a collision costs you shields/a life.
- Enemies never reach the bottom of the screen: a buffer strip keeps your home row clear.
- **Laser blasters:** start with the Pulse Laser and unlock a new blaster each time you clear a sector (up to 10). Toggle your active blaster any time in the **Armory** (or with `Q`/`E` and `1`–`9` in-game).
- **Space gems** give points. Special ammo gems grant temporary power-ups: Rapid Fire, Spread Shot, Plasma Rounds, and Homing Missiles. A rare Med-Kit grants an extra life.
- **Score** rewards gems collected, aliens blasted, and fast level/boss completion (time bonus).
- Synthesized retro sound effects and background music (toggle in the top-right during play).

### Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys / `WASD` |
| Fire | `Space` (hold) |
| Switch blaster | `Q` / `E`, or `1`–`9` |
| Pause | `P` / `Esc` |

## Develop

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build
npm run lint     # oxlint
```

## Leaderboard (optional Supabase backend)

Scores are always saved locally (`localStorage`). To enable a **global** leaderboard, set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` and create this table in the
Supabase SQL editor:

```sql
create table if not exists leaderboard (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  worlds integer not null default 0,
  bosses integer not null default 0,
  difficulty text not null default 'normal',
  created_at timestamptz not null default now()
);
alter table leaderboard enable row level security;
create policy "read all"   on leaderboard for select using (true);
create policy "insert all" on leaderboard for insert with check (true);
```

Already have the table from an earlier version? Add the difficulty column:

```sql
alter table leaderboard add column if not exists difficulty text not null default 'normal';
```

If the table or credentials are missing, the game silently falls back to local scores.

## Project structure

```
src/
  game/
    types.ts      shared types
    content.ts    worlds, bosses, blasters, gems (data-driven)
    audio.ts      Web Audio synthesized SFX + music
    engine.ts     canvas game engine (loop, player, aliens, gems, bosses)
  lib/
    storage.ts    progress persistence (localStorage)
    leaderboard.ts Supabase + localStorage leaderboard
    supabase.ts   Supabase client
  components/
    GameCanvas.tsx canvas host for the engine
  App.tsx         screen orchestration (title, map, boss select, armory, HUD, game over)
```
