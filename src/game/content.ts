// Data-driven game content: worlds, bosses, blasters, gems.
// Original deep-space theme — alien fleets, void monsters, and derelict hulks.

import type { BlasterDef, Difficulty, DifficultyMod, GemDef, WorldDef } from './types'

// Normal mirrors the original balance (all multipliers = 1). Easy dials
// everything down; Intense and Insane crank enemy count, speed, and fire rate.
export const DIFFICULTIES: Record<Difficulty, DifficultyMod> = {
  easy: {
    key: 'easy', label: 'Easy', blurb: 'Fewer, slower aliens. Relaxed shots.', color: '#5eff8a',
    quotaMul: 0.6, spawnRateMul: 1.5, maxConcurrentMul: 0.65,
    enemySpeedMul: 0.7, enemyFireMul: 1.6, bulletSpeedMul: 0.8, scoreMul: 0.8,
  },
  normal: {
    key: 'normal', label: 'Normal', blurb: 'The classic Cosmic Crusade balance.', color: '#5ef0ff',
    quotaMul: 1, spawnRateMul: 1, maxConcurrentMul: 1,
    enemySpeedMul: 1, enemyFireMul: 1, bulletSpeedMul: 1, scoreMul: 1,
  },
  intense: {
    key: 'intense', label: 'Intense', blurb: 'More aliens, faster ships and shots.', color: '#ffb347',
    quotaMul: 1.35, spawnRateMul: 0.72, maxConcurrentMul: 1.4,
    enemySpeedMul: 1.28, enemyFireMul: 0.65, bulletSpeedMul: 1.22, scoreMul: 1.35,
  },
  insane: {
    key: 'insane', label: 'Insane', blurb: 'A relentless swarm. Blistering fire.', color: '#ff5e5e',
    quotaMul: 1.7, spawnRateMul: 0.52, maxConcurrentMul: 1.75,
    enemySpeedMul: 1.55, enemyFireMul: 0.45, bulletSpeedMul: 1.45, scoreMul: 1.75,
  },
}

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'intense', 'insane']

export const BLASTERS: BlasterDef[] = [
  {
    id: 'pulse',
    name: 'Pulse Laser',
    flavor: 'Standard-issue sidearm. Reliable in any sector.',
    color: '#5ef0ff',
    fireDelay: 0.22, damage: 1, speed: 620, radius: 4, pattern: 'single', unlockWorld: -1,
  },
  {
    id: 'twin-ion',
    name: 'Twin Blaster',
    flavor: 'Double-barreled bolts. Twice the trouble.',
    color: '#8affc1',
    fireDelay: 0.2, damage: 1, speed: 640, radius: 4, pattern: 'twin', unlockWorld: 0,
  },
  {
    id: 'phaser',
    name: 'Rapid Repeater',
    flavor: 'Blistering rate of fire. Melts the front line.',
    color: '#ff9e5e',
    fireDelay: 0.11, damage: 1, speed: 700, radius: 3, pattern: 'single', unlockWorld: 1,
  },
  {
    id: 'spread-disruptor',
    name: 'Scatter Gun',
    flavor: 'A three-way spray for crowded space.',
    color: '#c98aff',
    fireDelay: 0.28, damage: 1, speed: 560, radius: 4, pattern: 'spread3', unlockWorld: 2,
  },
  {
    id: 'plasma-torpedo',
    name: 'Plasma Cannon',
    flavor: 'Slow, heavy, and absolutely devastating.',
    color: '#ff5ea8',
    fireDelay: 0.4, damage: 4, speed: 480, radius: 8, pattern: 'single', unlockWorld: 3,
  },
  {
    id: 'tri-beam',
    name: 'Lance Beam',
    flavor: 'A piercing energy lance. It goes right through.',
    color: '#ffe45e',
    fireDelay: 0.24, damage: 2, speed: 720, radius: 5, pattern: 'pierce', pierce: true, unlockWorld: 4,
  },
  {
    id: 'photon-spread',
    name: 'Photon Volley',
    flavor: 'Five photon bolts downrange at once.',
    color: '#5effe0',
    fireDelay: 0.34, damage: 1, speed: 600, radius: 4, pattern: 'spread5', unlockWorld: 5,
  },
  {
    id: 'wave-motion',
    name: 'Wave Cannon',
    flavor: 'A wide beam of pure kinetic force.',
    color: '#5e9dff',
    fireDelay: 0.3, damage: 3, speed: 660, radius: 10, pattern: 'wave', pierce: true, unlockWorld: 6,
  },
  {
    id: 'proton-nova',
    name: 'Nova Repeater',
    flavor: 'Rapid twin bolts of collapsed light.',
    color: '#ff7b3d',
    fireDelay: 0.16, damage: 2, speed: 760, radius: 5, pattern: 'twin', unlockWorld: 7,
  },
  {
    id: 'genesis-beam',
    name: 'Singularity Beam',
    flavor: 'A piercing tri-lance of collapsed matter.',
    color: '#b6ff5e',
    fireDelay: 0.13, damage: 3, speed: 800, radius: 6, pattern: 'spread3', pierce: true, unlockWorld: 8,
  },
]

export const GEMS: Record<string, GemDef> = {
  crystal: { id: 'crystal', name: 'Void Crystal', color: '#7ee8ff', points: 50 },
  plasmite: { id: 'plasmite', name: 'Plasmite', color: '#5effa8', points: 100 },
  aurium: { id: 'aurium', name: 'Aurium', color: '#ffd65e', points: 200 },
  rapid: { id: 'rapid', name: 'Rapid Cell', color: '#7bff5e', points: 30, ammo: 'rapid' },
  spread: { id: 'spread', name: 'Spread Cell', color: '#5ef0ff', points: 30, ammo: 'spread' },
  plasma: { id: 'plasma', name: 'Plasma Cell', color: '#ff5ea8', points: 30, ammo: 'plasma' },
  homing: { id: 'homing', name: 'Homing Cell', color: '#ffe45e', points: 30, ammo: 'homing' },
  shield: { id: 'shield', name: 'Shield Cell', color: '#5ef0ff', points: 20 },
  life: { id: 'life', name: 'Med-Kit', color: '#ff5e5e', points: 0, life: true },
}

// Weighted pool for random gem drops (score + occasional ammo).
export const GEM_DROP_POOL: string[] = [
  'crystal', 'crystal', 'crystal', 'crystal',
  'plasmite', 'plasmite', 'plasmite',
  'aurium',
  'rapid', 'spread', 'plasma', 'homing',
]

export const AMMO_LABEL: Record<string, string> = {
  rapid: 'Rapid Fire',
  spread: 'Spread Shot',
  plasma: 'Plasma Rounds',
  homing: 'Homing Missiles',
}

export const WORLDS: WorldDef[] = [
  {
    name: 'Rimward Frontier',
    subtitle: 'Pirate-infested asteroid belt',
    bgTop: '#2a1206', bgBottom: '#0a0402', accent: '#ffb347',
    bosses: [
      { name: 'Rok-Tammuz', title: 'Asteroid Devourer', color: '#c2a25e', hp: 60, weapon: 'aimed', kind: 'monster' },
      { name: 'ISV Marauder', title: 'Pirate Dreadnought', color: '#d89b57', hp: 80, weapon: 'spread', kind: 'warship' },
      { name: 'Grxil Broodmother', title: 'Belt Horror', color: '#8a6b3a', hp: 100, weapon: 'mines', kind: 'alien' },
      { name: 'Overseer KR-528', title: 'Mining Tyrant', color: '#e0b070', hp: 120, weapon: 'shotgun', kind: 'saucer' },
    ],
  },
  {
    name: 'Crimson Nebula',
    subtitle: 'A storm of ionized gas',
    bgTop: '#2a0812', bgBottom: '#0a0206', accent: '#ff5e7a',
    bosses: [
      { name: 'Pyre Wraith', title: 'Living Flame', color: '#a83a52', hp: 90, weapon: 'spiral', kind: 'alien' },
      { name: 'Scarlet Leviathan', title: 'Nebula Titan', color: '#c74a63', hp: 110, weapon: 'aimed', kind: 'monster' },
      { name: 'Ember Corsair', title: 'Raider Flagship', color: '#e05a75', hp: 130, weapon: 'ring', kind: 'warship' },
      { name: 'The Combustor', title: 'Ignition Core', color: '#ff6a85', hp: 150, weapon: 'mines', kind: 'saucer' },
    ],
  },
  {
    name: 'Glacial Rings',
    subtitle: 'Ice shards around a dead star',
    bgTop: '#0a1a2a', bgBottom: '#02060a', accent: '#7ec8ff',
    bosses: [
      { name: 'Cryos', title: 'Frozen Warden', color: '#8fb8d8', hp: 120, weapon: 'spread', kind: 'monster' },
      { name: 'Hoarfrost Queen', title: 'Ice Sovereign', color: '#aecde0', hp: 140, weapon: 'sweep', kind: 'alien' },
      { name: 'ISV Glacier', title: 'Frostbreaker Cruiser', color: '#6fa8d0', hp: 160, weapon: 'homing', kind: 'warship' },
      { name: 'Rime Colossus', title: 'Shard Golem', color: '#c0dcf0', hp: 180, weapon: 'mines', kind: 'monster' },
    ],
  },
  {
    name: 'The Void Expanse',
    subtitle: 'Where light goes to die',
    bgTop: '#12082a', bgBottom: '#04020a', accent: '#8a5eff',
    bosses: [
      { name: 'Null Serpent', title: 'Void Devourer', color: '#6a4ac7', hp: 150, weapon: 'mines', kind: 'monster' },
      { name: 'Umbra Legion', title: 'Shadow Fleet', color: '#7a5ad7', hp: 170, weapon: 'spiral', kind: 'warship' },
      { name: 'The Silent One', title: 'Void Wraith', color: '#8a6ae7', hp: 190, weapon: 'aimed', kind: 'alien' },
      { name: 'Entropy Engine', title: 'Collapse Core', color: '#9a7aff', hp: 220, weapon: 'ring', kind: 'saucer' },
    ],
  },
  {
    name: 'Verdant Moons',
    subtitle: 'Overgrown jungle worlds',
    bgTop: '#1a2a08', bgBottom: '#060a02', accent: '#b6ff5e',
    bosses: [
      { name: 'Sporex', title: 'Fungal Behemoth', color: '#9ac74a', hp: 180, weapon: 'shotgun', kind: 'monster' },
      { name: 'Vine Matriarch', title: 'Jungle Horror', color: '#aad75a', hp: 200, weapon: 'homing', kind: 'alien' },
      { name: 'Canopy Stalker', title: 'Apex Predator', color: '#bae76a', hp: 220, weapon: 'spread', kind: 'monster' },
      { name: 'Warlord Zathrix', title: 'Beast Master', color: '#caff7a', hp: 250, weapon: 'mines', kind: 'alien' },
    ],
  },
  {
    name: 'The Solar Forge',
    subtitle: 'In the corona of a blue star',
    bgTop: '#2a0a06', bgBottom: '#0a0302', accent: '#ff7b3d',
    bosses: [
      { name: 'Solaris Prime', title: 'Star-Forged Titan', color: '#e07a30', hp: 210, weapon: 'ring', kind: 'monster' },
      { name: 'Magma Wyrm', title: 'Corona Serpent', color: '#f08a40', hp: 230, weapon: 'sweep', kind: 'monster' },
      { name: 'ISV Helios', title: 'Sunspear Cruiser', color: '#ff9a50', hp: 260, weapon: 'mines', kind: 'warship' },
      { name: 'The Furnace', title: 'Plasma Heart', color: '#ffb060', hp: 300, weapon: 'spiral', kind: 'saucer' },
    ],
  },
  {
    name: 'The Ghost Armada',
    subtitle: 'A graveyard of derelict fleets',
    bgTop: '#0a2216', bgBottom: '#020805', accent: '#5edb9a',
    bosses: [
      { name: 'Revenant Hull', title: 'Ghost Ship', color: '#4acb8a', hp: 240, weapon: 'aimed', kind: 'warship' },
      { name: 'Admiral Mordis', title: 'The Hollow Captain', color: '#5adb9a', hp: 260, weapon: 'mines', kind: 'alien' },
      { name: 'Drift Wraith', title: 'Hull-Bound Terror', color: '#6aebaa', hp: 290, weapon: 'shotgun', kind: 'alien' },
      { name: 'Flagship Oblivion', title: 'Dead Fleet Core', color: '#7afbba', hp: 330, weapon: 'homing', kind: 'warship' },
    ],
  },
  {
    name: 'The Swarm Nexus',
    subtitle: 'A living, chittering hive',
    bgTop: '#0a0a2a', bgBottom: '#02020a', accent: '#5e8dff',
    bosses: [
      { name: 'Hive Tyrant', title: 'Swarm Overlord', color: '#4a5ac7', hp: 270, weapon: 'spiral', kind: 'monster' },
      { name: 'Broodmother Xel', title: 'Egg Sovereign', color: '#5a6ad7', hp: 300, weapon: 'ring', kind: 'alien' },
      { name: 'The Devourer', title: 'Living Hive', color: '#6a7ae7', hp: 340, weapon: 'sweep', kind: 'monster' },
      { name: 'Nexus Mind', title: 'Hive Intelligence', color: '#7a8aff', hp: 380, weapon: 'mines', kind: 'saucer' },
    ],
  },
  {
    name: "Event Horizon",
    subtitle: 'The edge of a black hole',
    bgTop: '#1a0a0a', bgBottom: '#050202', accent: '#ff5e5e',
    bosses: [
      { name: 'Gravik', title: 'Gravity Fiend', color: '#c74a4a', hp: 320, weapon: 'mines', kind: 'monster' },
      { name: 'ISV Eventide', title: 'Horizon Breaker', color: '#d75a5a', hp: 360, weapon: 'aimed', kind: 'warship' },
      { name: 'The Collapsar', title: 'Singularity Beast', color: '#e76a6a', hp: 400, weapon: 'spiral', kind: 'monster' },
      { name: 'Warden of the Abyss', title: 'Horizon Keeper', color: '#ff5e5e', hp: 460, weapon: 'ring', kind: 'alien' },
    ],
  },
  {
    name: 'The Galactic Core',
    subtitle: 'The heart of the galaxy',
    bgTop: '#2a1a00', bgBottom: '#0a0600', accent: '#ffd65e',
    bosses: [
      { name: 'Coreborn', title: 'Ancient Guardian', color: '#e0b040', hp: 380, weapon: 'sweep', kind: 'saucer' },
      { name: 'The Annihilator', title: 'Planet-Ender', color: '#f0c050', hp: 440, weapon: 'shotgun', kind: 'warship' },
      { name: 'Omega Serpent', title: 'Galaxy Eater', color: '#ffd060', hp: 520, weapon: 'homing', kind: 'monster' },
      { name: 'Sovereign Prime', title: 'Heart of the Galaxy', color: '#ffe070', hp: 640, weapon: 'mines', kind: 'saucer' },
    ],
  },
]

/** Bosses you must defeat in a world to unlock the next one. */
export const BOSSES_TO_ADVANCE = 2
export const TOTAL_WORLDS = WORLDS.length

export function bossKey(world: number, boss: number): string {
  return `${world}-${boss}`
}
