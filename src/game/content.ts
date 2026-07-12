// Data-driven game content: worlds, bosses, blasters, gems.
// Retro space theme with affectionate nods to Star Trek & Star Wars.

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
    flavor: 'Standard issue. Set phasers to fun.',
    color: '#5ef0ff',
    fireDelay: 0.22,
    damage: 1,
    speed: 620,
    radius: 4,
    pattern: 'single',
    unlockWorld: -1,
  },
  {
    id: 'twin-ion',
    name: 'Twin Ion Cannon',
    flavor: 'Twin bolts. That TIE-fighter whine, chef’s kiss.',
    color: '#8affc1',
    fireDelay: 0.2,
    damage: 1,
    speed: 640,
    radius: 4,
    pattern: 'twin',
    unlockWorld: 0,
  },
  {
    id: 'phaser',
    name: 'Phaser Array',
    flavor: 'Rapid pulses. Starfleet approved.',
    color: '#ff9e5e',
    fireDelay: 0.11,
    damage: 1,
    speed: 700,
    radius: 3,
    pattern: 'single',
    unlockWorld: 1,
  },
  {
    id: 'spread-disruptor',
    name: 'Spread Disruptor',
    flavor: 'Three-way spray for crowded sectors.',
    color: '#c98aff',
    fireDelay: 0.28,
    damage: 1,
    speed: 560,
    radius: 4,
    pattern: 'spread3',
    unlockWorld: 2,
  },
  {
    id: 'plasma-torpedo',
    name: 'Plasma Torpedo',
    flavor: 'Slow, heavy, and absolutely devastating.',
    color: '#ff5ea8',
    fireDelay: 0.4,
    damage: 4,
    speed: 480,
    radius: 8,
    pattern: 'single',
    unlockWorld: 3,
  },
  {
    id: 'tri-beam',
    name: 'Tri-Beam Disruptor',
    flavor: 'Piercing lattice. It goes right through them.',
    color: '#ffe45e',
    fireDelay: 0.24,
    damage: 2,
    speed: 720,
    radius: 5,
    pattern: 'pierce',
    pierce: true,
    unlockWorld: 4,
  },
  {
    id: 'photon-spread',
    name: 'Photon Volley',
    flavor: 'Five photon bolts. Load the torpedo bays.',
    color: '#5effe0',
    fireDelay: 0.34,
    damage: 1,
    speed: 600,
    radius: 4,
    pattern: 'spread5',
    unlockWorld: 5,
  },
  {
    id: 'wave-motion',
    name: 'Wave Motion Gun',
    flavor: 'A wide beam of pure resolve.',
    color: '#5e9dff',
    fireDelay: 0.3,
    damage: 3,
    speed: 660,
    radius: 10,
    pattern: 'wave',
    pierce: true,
    unlockWorld: 6,
  },
  {
    id: 'proton-nova',
    name: 'Proton Nova',
    flavor: 'Great shot, kid — that was one in a million.',
    color: '#ff7b3d',
    fireDelay: 0.16,
    damage: 2,
    speed: 760,
    radius: 5,
    pattern: 'twin',
    unlockWorld: 7,
  },
  {
    id: 'genesis-beam',
    name: 'Genesis Beam',
    flavor: 'It can bring life — or take it away.',
    color: '#b6ff5e',
    fireDelay: 0.13,
    damage: 3,
    speed: 800,
    radius: 6,
    pattern: 'spread3',
    pierce: true,
    unlockWorld: 8,
  },
]

export const GEMS: Record<string, GemDef> = {
  dilithium: { id: 'dilithium', name: 'Dilithium', color: '#7ee8ff', points: 50 },
  kyber: { id: 'kyber', name: 'Kyber Crystal', color: '#5effa8', points: 100 },
  latinum: { id: 'latinum', name: 'Latinum', color: '#ffd65e', points: 200 },
  rapid: { id: 'rapid', name: 'Rapid Cell', color: '#7bff5e', points: 30, ammo: 'rapid' },
  spread: { id: 'spread', name: 'Spread Cell', color: '#5ef0ff', points: 30, ammo: 'spread' },
  plasma: { id: 'plasma', name: 'Plasma Cell', color: '#ff5ea8', points: 30, ammo: 'plasma' },
  homing: { id: 'homing', name: 'Homing Cell', color: '#ffe45e', points: 30, ammo: 'homing' },
  life: { id: 'life', name: 'Med-Kit', color: '#ff5e5e', points: 0, life: true },
}

// Weighted pool for random gem drops (score + occasional ammo/life).
export const GEM_DROP_POOL: string[] = [
  'dilithium', 'dilithium', 'dilithium', 'dilithium',
  'kyber', 'kyber', 'kyber',
  'latinum',
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
    name: 'Tatooine Reach',
    subtitle: 'Twin-sun desert sector',
    bgTop: '#2a1206', bgBottom: '#0a0402', accent: '#ffb347',
    bosses: [
      { name: 'Jabba-9', title: 'The Hutt Dreadnought', color: '#c2a25e', hp: 60 },
      { name: 'Sarlacc Maw', title: 'Pit of Carkoon', color: '#8a6b3a', hp: 80 },
      { name: 'Krayt Warden', title: 'Dune Leviathan', color: '#d89b57', hp: 100 },
      { name: 'Mos Reaver', title: 'Cantina Enforcer', color: '#e0b070', hp: 120 },
    ],
  },
  {
    name: 'Klingon Frontier',
    subtitle: 'Neutral zone breach',
    bgTop: '#2a0812', bgBottom: '#0a0206', accent: '#ff5e7a',
    bosses: [
      { name: 'IKS Kronos', title: 'Bird-of-Prey', color: '#a83a52', hp: 90 },
      { name: 'Warlord Gowron', title: 'Blade of Honor', color: '#c74a63', hp: 110 },
      { name: 'The Negh’Var', title: 'Flagship Terror', color: '#e05a75', hp: 130 },
      { name: 'Kahless Prime', title: 'Empire’s Fury', color: '#ff6a85', hp: 150 },
    ],
  },
  {
    name: 'Hoth Ice Belt',
    subtitle: 'Frozen echo base',
    bgTop: '#0a1a2a', bgBottom: '#02060a', accent: '#7ec8ff',
    bosses: [
      { name: 'AT-AT Colossus', title: 'Blizzard Walker', color: '#8fb8d8', hp: 120 },
      { name: 'Wampa Alpha', title: 'Ice Cavern Beast', color: '#aecde0', hp: 140 },
      { name: 'Probe Swarm', title: 'Imperial Recon', color: '#6fa8d0', hp: 160 },
      { name: 'General Veers', title: 'Blizzard Force', color: '#c0dcf0', hp: 180 },
    ],
  },
  {
    name: 'Romulan Neutral Zone',
    subtitle: 'Cloaked ambush grounds',
    bgTop: '#0a2a1a', bgBottom: '#020a06', accent: '#5effa8',
    bosses: [
      { name: 'Warbird D’deridex', title: 'Cloaked Talon', color: '#4ac77a', hp: 150 },
      { name: 'Tal Shiar', title: 'Shadow Order', color: '#5ad78a', hp: 170 },
      { name: 'Praetor Shinzon', title: 'The Scimitar', color: '#6ae79a', hp: 190 },
      { name: 'Nero’s Narada', title: 'Vengeance Miner', color: '#7affaa', hp: 220 },
    ],
  },
  {
    name: 'Endor Moon Cluster',
    subtitle: 'Forest sanctuary orbit',
    bgTop: '#1a2a08', bgBottom: '#060a02', accent: '#b6ff5e',
    bosses: [
      { name: 'Shield Bunker', title: 'Imperial Generator', color: '#9ac74a', hp: 180 },
      { name: 'Scout Legion', title: 'Speeder Squadron', color: '#aad75a', hp: 200 },
      { name: 'Ewok Trap', title: 'Log of Doom', color: '#bae76a', hp: 220 },
      { name: 'Moff Jerjerrod', title: 'Station Commander', color: '#caff7a', hp: 250 },
    ],
  },
  {
    name: 'The Mutara Nebula',
    subtitle: 'Sensor-blind gas storm',
    bgTop: '#2a0a2a', bgBottom: '#0a020a', accent: '#e05eff',
    bosses: [
      { name: 'USS Reliant', title: 'Hijacked Starship', color: '#b04ac7', hp: 210 },
      { name: 'Ceti Eel', title: 'Mind Parasite', color: '#c05ad7', hp: 230 },
      { name: 'Khan’s Wrath', title: 'From Hell’s Heart', color: '#d06ae7', hp: 260 },
      { name: 'Genesis Device', title: 'Detonation Core', color: '#e07aff', hp: 300 },
    ],
  },
  {
    name: 'Dagobah Swamp Orbit',
    subtitle: 'Where the Force is strong',
    bgTop: '#0a2216', bgBottom: '#020805', accent: '#5edb9a',
    bosses: [
      { name: 'Cave Phantom', title: 'Only What You Take', color: '#4acb8a', hp: 240 },
      { name: 'Bog Kraken', title: 'Dagobah Depths', color: '#5adb9a', hp: 260 },
      { name: 'Dark Apprentice', title: 'Do. Or Do Not.', color: '#6aebaa', hp: 290 },
      { name: 'The Emperor’s Eye', title: 'Sith Vision', color: '#7afbba', hp: 330 },
    ],
  },
  {
    name: 'The Borg Expanse',
    subtitle: 'Resistance is futile',
    bgTop: '#0a0a2a', bgBottom: '#02020a', accent: '#5e8dff',
    bosses: [
      { name: 'Cube 001', title: 'Assimilation Grid', color: '#4a5ac7', hp: 270 },
      { name: 'The Collective', title: 'One Mind', color: '#5a6ad7', hp: 300 },
      { name: 'Locutus', title: 'Voice of the Borg', color: '#6a7ae7', hp: 340 },
      { name: 'Borg Queen', title: 'Order From Chaos', color: '#7a8aff', hp: 380 },
    ],
  },
  {
    name: 'Death Star Debris',
    subtitle: 'That’s no moon…',
    bgTop: '#1a1a1a', bgBottom: '#050505', accent: '#ff5e5e',
    bosses: [
      { name: 'Trench Turret', title: 'Surface Cannon', color: '#c74a4a', hp: 320 },
      { name: 'TIE Advanced', title: 'Vader’s Wing', color: '#d75a5a', hp: 360 },
      { name: 'Superlaser Core', title: 'Reactor Shaft', color: '#e76a6a', hp: 400 },
      { name: 'Lord Vader', title: 'The Dark Lord', color: '#ff5e5e', hp: 460 },
    ],
  },
  {
    name: 'The Final Nexus',
    subtitle: 'Genesis of a new galaxy',
    bgTop: '#2a1a00', bgBottom: '#0a0600', accent: '#ffd65e',
    bosses: [
      { name: 'Q Continuum', title: 'Trial Never Ends', color: '#e0b040', hp: 380 },
      { name: 'Starkiller', title: 'Planet Devourer', color: '#f0c050', hp: 440 },
      { name: 'The Emperor', title: 'Unlimited Power', color: '#ffd060', hp: 520 },
      { name: 'Nexus Prime', title: 'End of All Things', color: '#ffe070', hp: 640 },
    ],
  },
]

/** Bosses you must defeat in a world to unlock the next one. */
export const BOSSES_TO_ADVANCE = 2
export const TOTAL_WORLDS = WORLDS.length

export function bossKey(world: number, boss: number): string {
  return `${world}-${boss}`
}
