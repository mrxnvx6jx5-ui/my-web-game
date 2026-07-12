// Shared type definitions for the game.

export type Vec = { x: number; y: number }

export interface BlasterDef {
  id: string
  name: string
  /** Short flavor line. */
  flavor: string
  color: string
  /** Seconds between shots when holding fire. */
  fireDelay: number
  /** Damage per projectile. */
  damage: number
  /** Projectile speed (logical px/sec). */
  speed: number
  /** Projectile radius. */
  radius: number
  /** Number of projectiles / spread pattern. */
  pattern: 'single' | 'twin' | 'spread3' | 'spread5' | 'pierce' | 'wave'
  /** Does the projectile pass through enemies? */
  pierce?: boolean
  /** World index (0-based) the player must clear to unlock it. -1 = starter. */
  unlockWorld: number
}

export type AmmoType = 'rapid' | 'spread' | 'plasma' | 'homing'

export type Difficulty = 'easy' | 'normal' | 'intense' | 'insane'

export interface DifficultyMod {
  key: Difficulty
  label: string
  blurb: string
  color: string
  /** How many aliens per level (scales the base quota). */
  quotaMul: number
  /** Spawn interval multiplier — <1 spawns faster. */
  spawnRateMul: number
  /** Max aliens on screen at once. */
  maxConcurrentMul: number
  /** Alien movement / descent speed. */
  enemySpeedMul: number
  /** Enemy fire cooldown multiplier — <1 shoots more often. */
  enemyFireMul: number
  /** Enemy projectile speed. */
  bulletSpeedMul: number
  /** Score bonus multiplier for level/boss completion. */
  scoreMul: number
}

export interface GemDef {
  id: string
  name: string
  color: string
  points: number
  /** If set, collecting grants this temporary ammo. */
  ammo?: AmmoType
  /** If true, grants an extra life. */
  life?: boolean
}

export type BossWeapon =
  | 'spread' | 'aimed' | 'spiral' | 'ring' | 'shotgun' | 'homing' | 'sweep' | 'mines'

export interface BossDef {
  name: string
  title: string
  color: string
  hp: number
  /** The boss's signature attack — each boss in a world uses a different one. */
  weapon: BossWeapon
}

export interface WorldDef {
  name: string
  subtitle: string
  bgTop: string
  bgBottom: string
  accent: string
  bosses: BossDef[]
}

export interface RunStats {
  score: number
  gems: number
  kills: number
  bossesDefeated: number
  worldsCleared: number
  timeMs: number
}

export interface Progress {
  /** Highest world index unlocked (0-based). */
  unlockedWorld: number
  /** Map of "world-boss" -> true for defeated bosses. */
  defeatedBosses: Record<string, boolean>
  /** Blaster ids the player owns. */
  blasters: string[]
  bestScore: number
}

export interface StageConfig {
  world: number
  boss: number
  /** 1-3 for normal levels, 0 for the boss encounter. */
  level: number
}

export type StageResult =
  | { type: 'levelComplete'; stats: RunStats }
  | { type: 'bossDefeated'; stats: RunStats }
  | { type: 'gameOver'; stats: RunStats }

export interface HudState {
  score: number
  lives: number
  gems: number
  timeMs: number
  blasterName: string
  ammoType: AmmoType | null
  ammoCount: number
  levelLabel: string
  goalCurrent: number
  goalTarget: number
  bossHp: number
  bossMaxHp: number
  bossName: string
  paused: boolean
}
