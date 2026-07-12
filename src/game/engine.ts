// Canvas game engine: the actual playable shooter.
// Runs an independent requestAnimationFrame loop and pushes HUD state out
// via callbacks. React only owns the menus/overlays around it.

import { audio } from './audio'
import { BLASTERS, DIFFICULTIES, GEMS, GEM_DROP_POOL, WORLDS } from './content'
import type {
  AmmoType, BlasterDef, BossKind, BossWeapon, Difficulty, DifficultyMod, HudState, RunStats, StageConfig, StageResult,
} from './types'

export const W = 900
export const H = 600

interface Bullet {
  x: number; y: number; vx: number; vy: number; r: number
  dmg: number; color: string; pierce: boolean; homing: boolean
  hits: Set<number>
}
interface EBullet { x: number; y: number; vx: number; vy: number; r: number; homing?: boolean; dead?: boolean }
interface Alien {
  id: number; x: number; y: number; w: number; h: number
  hp: number; maxHp: number; type: number; points: number
  vx: number; vy: number; t: number; fireCd: number; baseX: number
}
interface Boss {
  id: number; x: number; y: number; w: number; h: number
  hp: number; maxHp: number; t: number; fireCd: number
  dir: number; name: string; title: string; color: string; spawnCd: number
  flash: number; weapon: BossWeapon; ang: number; kind: BossKind
}
interface Mine {
  id: number; x: number; y: number; vx: number; vy: number
  r: number; hp: number; fuse: number; pulse: number
}
interface Gem {
  id: string; x: number; y: number; vx: number; vy: number; r: number; t: number
  color: string; points: number; ammo?: AmmoType; life?: boolean; shield?: boolean
}
interface Asteroid {
  id: number; x: number; y: number; vx: number; vy: number; r: number
  hp: number; maxHp: number; rot: number; spin: number; shape: number[]
}
interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number
  color: string; size: number
}
interface Star { x: number; y: number; z: number }
interface FloatText { x: number; y: number; text: string; color: string; life: number }

interface Callbacks {
  onHud: (h: HudState) => void
  onResult: (r: StageResult) => void
}

const AMMO_START: Record<AmmoType, number> = {
  rapid: 70, spread: 45, plasma: 25, homing: 35,
}

// The top HUD strip acts as a buffer where enemies enter; this mirrors it at
// the bottom — enemies never descend past ENEMY_FLOOR, keeping the player's
// home row (the bottom buffer band) clear.
const BOTTOM_BUFFER = 96
const ENEMY_FLOOR = H - BOTTOM_BUFFER

// Shields absorb hits before lives are lost; full at the start of every level.
const MAX_SHIELD = 100
const SHIELD_HIT_COST = 34
const SHIELD_GEM_RESTORE = 50
// Asteroids start appearing from this world index (0-based) onward.
const ASTEROID_FROM_WORLD = 2

export class GameEngine {
  private ctx: CanvasRenderingContext2D
  private cb: Callbacks
  private raf = 0
  private lastT = 0
  private idc = 1
  private interval: number | null = null

  // Session (persists across stages within one run/life pool).
  private score = 0
  private lives = 3
  private gemsCollected = 0
  private kills = 0
  private bossesDefeated = 0
  private worldsCleared = 0
  private runStartMs = 0

  // Difficulty
  private diff: DifficultyMod = DIFFICULTIES.normal

  // Blasters
  private owned: BlasterDef[] = [BLASTERS[0]]
  private blaster: BlasterDef = BLASTERS[0]
  private ammoType: AmmoType | null = null
  private ammoCount = 0

  // Stage state
  private cfg: StageConfig = { world: 0, boss: 0, level: 1 }
  private aliens: Alien[] = []
  private bullets: Bullet[] = []
  private ebullets: EBullet[] = []
  private gems: Gem[] = []
  private asteroids: Asteroid[] = []
  private mines: Mine[] = []
  private particles: Particle[] = []
  private floats: FloatText[] = []
  private stars: Star[] = []
  private boss: Boss | null = null

  private quota = 0
  private spawned = 0
  private killedThisStage = 0
  private spawnTimer = 0
  private asteroidTimer = 0
  private stageStartMs = 0
  private fireCd = 0
  private stageBanner = 0
  private awaiting = false
  private paused = false
  private running = false

  // Player
  private px = W / 2
  private py = H - 70
  private pvx = 0
  private pvy = 0
  private invuln = 0
  private shield = MAX_SHIELD
  private keys: Record<string, boolean> = {}

  // Touch controls (drag to move, auto-fire while touching)
  private touchEnabled = false
  private touchActive = false
  private lastTouch: { x: number; y: number } | null = null

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    this.ctx = ctx
    this.cb = cb
    for (let i = 0; i < 90; i++) {
      this.stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.9 + 0.1 })
    }
    this.runStartMs = performance.now()
    this.bindInput()
  }

  // ---- Session setup ----
  setOwnedBlasters(ids: string[]) {
    this.owned = ids.map((id) => BLASTERS.find((b) => b.id === id)).filter(Boolean) as BlasterDef[]
    if (this.owned.length === 0) this.owned = [BLASTERS[0]]
    if (!this.owned.includes(this.blaster)) this.blaster = this.owned[0]
  }
  setBlaster(id: string) {
    const b = this.owned.find((x) => x.id === id)
    if (b) { this.blaster = b; audio.uiClick(); this.emitHud() }
  }
  cycleBlaster(dir: number) {
    const i = this.owned.indexOf(this.blaster)
    const n = (i + dir + this.owned.length) % this.owned.length
    this.blaster = this.owned[n]
    audio.uiClick()
    this.emitHud()
  }
  getStats(): RunStats {
    return {
      score: this.score, gems: this.gemsCollected, kills: this.kills,
      bossesDefeated: this.bossesDefeated, worldsCleared: this.worldsCleared,
      timeMs: performance.now() - this.runStartMs,
    }
  }
  get currentLives() { return this.lives }

  // ---- Stage lifecycle ----
  loadStage(cfg: StageConfig) {
    this.cfg = cfg
    this.aliens = []
    this.bullets = []
    this.ebullets = []
    this.gems = []
    this.asteroids = []
    this.mines = []
    this.particles = []
    this.floats = []
    this.boss = null
    this.spawned = 0
    this.killedThisStage = 0
    this.spawnTimer = 0
    this.asteroidTimer = 2 + Math.random() * 2
    this.fireCd = 0
    this.awaiting = false
    this.paused = false
    this.px = W / 2
    this.py = H - 70
    this.pvx = 0
    this.pvy = 0
    this.invuln = 1.2
    this.shield = MAX_SHIELD // full shields at the start of every level
    this.stageStartMs = performance.now()
    this.stageBanner = 2.2

    if (cfg.level === 0) {
      this.spawnBoss()
    } else {
      const world = cfg.world
      this.quota = Math.max(4, Math.round((8 + world * 2 + cfg.level * 3) * this.diff.quotaMul))
    }
    this.emitHud()
  }

  start() {
    if (this.running) return
    this.running = true
    this.lastT = performance.now()
    audio.startMusic()
    document.addEventListener('visibilitychange', this.onVisibility)
    this.startDriver()
  }

  /**
   * Drive the loop with requestAnimationFrame when the tab is visible (smooth,
   * vsync-aligned), and fall back to a 60fps timer when it's hidden — browsers
   * pause rAF entirely in background tabs, which would otherwise freeze the game.
   */
  private startDriver() {
    this.stopDriver()
    this.lastT = performance.now()
    if (typeof document !== 'undefined' && document.hidden) {
      this.interval = window.setInterval(() => this.frame(performance.now()), 1000 / 60)
    } else {
      this.raf = requestAnimationFrame(this.rafLoop)
    }
  }
  private stopDriver() {
    cancelAnimationFrame(this.raf)
    if (this.interval !== null) { window.clearInterval(this.interval); this.interval = null }
  }
  private rafLoop = () => {
    if (!this.running) return
    this.frame(performance.now())
    this.raf = requestAnimationFrame(this.rafLoop)
  }
  private onVisibility = () => {
    if (this.running) this.startDriver()
  }
  private frame(now: number) {
    let dt = (now - this.lastT) / 1000
    this.lastT = now
    if (dt > 0.05) dt = 0.05 // clamp big frame gaps (tab switches, stalls)
    try {
      if (!this.paused && !this.awaiting) this.update(dt)
      this.render()
    } catch (err) {
      console.error('[engine] loop error:', err)
    }
  }

  pause() { this.paused = true; this.emitHud() }
  resume() { this.paused = false; this.lastT = performance.now(); this.emitHud() }
  togglePause() { if (this.paused) this.resume(); else this.pause() }
  get isPaused() { return this.paused }

  destroy() {
    this.running = false
    this.stopDriver()
    audio.stopMusic()
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    const c = this.ctx.canvas
    c.removeEventListener('touchstart', this.onTouchStart)
    c.removeEventListener('touchmove', this.onTouchMove)
    c.removeEventListener('touchend', this.onTouchEnd)
    c.removeEventListener('touchcancel', this.onTouchEnd)
  }

  // ---- Input ----
  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    const c = this.ctx.canvas
    c.addEventListener('touchstart', this.onTouchStart, { passive: false })
    c.addEventListener('touchmove', this.onTouchMove, { passive: false })
    c.addEventListener('touchend', this.onTouchEnd)
    c.addEventListener('touchcancel', this.onTouchEnd)
  }

  setDifficulty(key: Difficulty) {
    this.diff = DIFFICULTIES[key]
  }

  /** Enable/disable on-canvas touch controls (drag to move, auto-fire). */
  setTouchControls(on: boolean) {
    this.touchEnabled = on
    if (!on) { this.touchActive = false; this.lastTouch = null }
  }

  private touchPoint(t: Touch): { x: number; y: number } {
    const rect = this.ctx.canvas.getBoundingClientRect()
    const sx = W / (rect.width || 1)
    const sy = H / (rect.height || 1)
    return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy }
  }
  private onTouchStart = (e: TouchEvent) => {
    if (!this.touchEnabled) return
    e.preventDefault()
    this.lastTouch = this.touchPoint(e.touches[0])
    this.touchActive = true
    audio.unlock()
  }
  private onTouchMove = (e: TouchEvent) => {
    if (!this.touchEnabled || !this.touchActive) return
    e.preventDefault()
    const p = this.touchPoint(e.touches[0])
    if (this.lastTouch) {
      // Relative drag: ship follows the finger's movement 1:1, so it never
      // sits hidden under the fingertip.
      this.px = Math.max(24, Math.min(W - 24, this.px + (p.x - this.lastTouch.x)))
      this.py = Math.max(H * 0.45, Math.min(H - 30, this.py + (p.y - this.lastTouch.y)))
    }
    this.lastTouch = p
  }
  private onTouchEnd = () => {
    this.touchActive = false
    this.lastTouch = null
  }
  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault()
    this.keys[k] = true
    if (k === 'p' || k === 'escape') this.togglePause()
    if (k === 'q') this.cycleBlaster(-1)
    if (k === 'e') this.cycleBlaster(1)
    if (k >= '1' && k <= '9') {
      const idx = parseInt(k, 10) - 1
      if (this.owned[idx]) this.setBlaster(this.owned[idx].id)
    }
  }
  private onKeyUp = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = false }

  // ---- Spawning ----
  private spawnAlien() {
    const world = this.cfg.world
    const type = Math.floor(Math.random() * 3)
    const size = 26 + type * 8
    const hp = 1 + Math.floor(world / 2) + type
    const points = 25 + world * 5 + type * 15
    const x = 40 + Math.random() * (W - 80)
    this.aliens.push({
      id: this.idc++, x, baseX: x, y: -30, w: size, h: size,
      hp, maxHp: hp, type, points,
      vx: (Math.random() - 0.5) * 40 * this.diff.enemySpeedMul,
      vy: (40 + world * 5 + Math.random() * 30) * this.diff.enemySpeedMul,
      t: Math.random() * 6, fireCd: (1 + Math.random() * 2) * this.diff.enemyFireMul,
    })
    this.spawned++
  }

  /** Asteroids appear in tougher sectors (and always on Intense/Insane). */
  private asteroidsActive(): boolean {
    return this.cfg.world >= ASTEROID_FROM_WORLD || this.diff.enemySpeedMul > 1.2
  }

  private spawnAsteroid() {
    const big = Math.random() < 0.4
    const r = big ? 26 + Math.random() * 14 : 14 + Math.random() * 10
    // Irregular rock silhouette: per-vertex radius jitter.
    const verts = 8 + Math.floor(Math.random() * 4)
    const shape: number[] = []
    for (let i = 0; i < verts; i++) shape.push(0.72 + Math.random() * 0.5)
    this.asteroids.push({
      id: this.idc++,
      x: 30 + Math.random() * (W - 60), y: -r - 10,
      vx: (Math.random() - 0.5) * 70,
      vy: (60 + this.cfg.world * 6 + Math.random() * 50) * this.diff.enemySpeedMul,
      r, hp: Math.ceil(r / 8), maxHp: Math.ceil(r / 8),
      rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 2, shape,
    })
  }

  private spawnBoss() {
    const bdef = WORLDS[this.cfg.world].bosses[this.cfg.boss]
    const hp = bdef.hp
    this.boss = {
      id: this.idc++, x: W / 2, y: 110, w: 140, h: 90,
      hp, maxHp: hp, t: 0, fireCd: 1.2, dir: 1,
      name: bdef.name, title: bdef.title, color: bdef.color,
      spawnCd: 3, flash: 0, weapon: bdef.weapon, ang: 0, kind: bdef.kind,
    }
    // give organic/saucer bosses a rounder footprint than warships
    if (bdef.kind === 'monster' || bdef.kind === 'alien') { this.boss.w = 150; this.boss.h = 130 }
    else if (bdef.kind === 'saucer') { this.boss.w = 180; this.boss.h = 90 }
    else { this.boss.w = 170; this.boss.h = 100 }
  }

  private spawnMine(x: number, y: number) {
    this.mines.push({
      id: this.idc++, x, y,
      vx: (Math.random() - 0.5) * 30,
      vy: (35 + Math.random() * 25) * this.diff.enemySpeedMul,
      r: 13, hp: 2, fuse: 5 + Math.random() * 2, pulse: 0,
    })
  }

  private explodeMine(m: Mine) {
    const n = 8 + Math.floor(this.cfg.world / 2)
    const sp = (140 + this.cfg.world * 6) * this.diff.bulletSpeedMul
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2
      this.ebullets.push({ x: m.x, y: m.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 5 })
    }
    this.spawnParticles(m.x, m.y, '#ff8a5e', 22)
    audio.explosion()
  }

  // ---- Firing ----
  private fire() {
    const usingAmmo = this.ammoCount > 0 && this.ammoType
    let delay = this.blaster.fireDelay
    let dmg = this.blaster.damage
    let pattern = this.blaster.pattern
    let color = this.blaster.color
    let pierce = !!this.blaster.pierce
    let homing = false
    const speed = this.blaster.speed
    let radius = this.blaster.radius

    if (usingAmmo && this.ammoType) {
      switch (this.ammoType) {
        case 'rapid': delay = 0.07; dmg = 1; pattern = 'single'; color = '#7bff5e'; break
        case 'spread': delay = 0.16; dmg = 1; pattern = 'spread5'; color = '#5ef0ff'; break
        case 'plasma': delay = 0.3; dmg = 5; pattern = 'single'; color = '#ff5ea8'; radius = 9; break
        case 'homing': delay = 0.18; dmg = 2; pattern = 'single'; color = '#ffe45e'; homing = true; break
      }
    }
    if (this.fireCd > 0) return
    this.fireCd = delay

    const mk = (vx: number, vy: number) => {
      this.bullets.push({
        x: this.px, y: this.py - 22, vx, vy, r: radius, dmg, color,
        pierce, homing, hits: new Set(),
      })
    }
    const up = -speed
    switch (pattern) {
      case 'single': mk(0, up); break
      case 'twin':
        this.bullets.push({ x: this.px - 12, y: this.py - 18, vx: 0, vy: up, r: radius, dmg, color, pierce, homing, hits: new Set() })
        this.bullets.push({ x: this.px + 12, y: this.py - 18, vx: 0, vy: up, r: radius, dmg, color, pierce, homing, hits: new Set() })
        break
      case 'spread3':
        mk(0, up); mk(-140, up * 0.95); mk(140, up * 0.95); break
      case 'spread5':
        mk(0, up); mk(-120, up * 0.96); mk(120, up * 0.96); mk(-240, up * 0.9); mk(240, up * 0.9); break
      case 'pierce': mk(0, up); break
      case 'wave':
        this.bullets.push({ x: this.px, y: this.py - 22, vx: 0, vy: up, r: radius, dmg, color, pierce: true, homing, hits: new Set() })
        break
    }
    audio.shoot(usingAmmo && this.ammoType === 'plasma' ? 0.6 : 1)
    if (usingAmmo) {
      this.ammoCount--
      if (this.ammoCount <= 0) { this.ammoType = null; this.ammoCount = 0 }
    }
  }

  // ---- Update ----
  private update(dt: number) {
    this.fireCd -= dt
    if (this.invuln > 0) this.invuln -= dt
    if (this.stageBanner > 0) this.stageBanner -= dt

    // Player movement
    const accel = 2600
    const maxV = 420
    let ax = 0, ay = 0
    if (this.keys['arrowleft'] || this.keys['a']) ax -= 1
    if (this.keys['arrowright'] || this.keys['d']) ax += 1
    if (this.keys['arrowup'] || this.keys['w']) ay -= 1
    if (this.keys['arrowdown'] || this.keys['s']) ay += 1
    this.pvx += ax * accel * dt
    this.pvy += ay * accel * dt
    if (ax === 0) this.pvx *= 0.82
    if (ay === 0) this.pvy *= 0.82
    this.pvx = Math.max(-maxV, Math.min(maxV, this.pvx))
    this.pvy = Math.max(-maxV, Math.min(maxV, this.pvy))
    this.px += this.pvx * dt
    this.py += this.pvy * dt
    this.px = Math.max(24, Math.min(W - 24, this.px))
    this.py = Math.max(H * 0.45, Math.min(H - 30, this.py))

    // Fire on Space (keyboard) or while a touch is held (mobile auto-fire).
    if (this.keys[' '] || (this.touchEnabled && this.touchActive)) this.fire()

    // Stars
    for (const s of this.stars) {
      s.y += (30 + s.z * 90) * dt
      if (s.y > H) { s.y = 0; s.x = Math.random() * W }
    }

    // Player bullets
    for (const b of this.bullets) {
      if (b.homing) {
        const target = this.nearestEnemy(b.x, b.y)
        if (target) {
          const dx = target.x - b.x, dy = target.y - b.y
          const d = Math.hypot(dx, dy) || 1
          const desiredVx = (dx / d) * 620, desiredVy = (dy / d) * 620
          b.vx += (desiredVx - b.vx) * Math.min(1, dt * 6)
          b.vy += (desiredVy - b.vy) * Math.min(1, dt * 6)
        }
      }
      b.x += b.vx * dt
      b.y += b.vy * dt
    }
    this.bullets = this.bullets.filter((b) => b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20)

    // Aliens
    if (this.cfg.level !== 0) {
      this.spawnTimer -= dt
      const maxConcurrent = Math.max(2, Math.round((4 + this.cfg.world) * this.diff.maxConcurrentMul))
      if (this.spawned < this.quota && this.aliens.length < maxConcurrent && this.spawnTimer <= 0) {
        this.spawnAlien()
        this.spawnTimer = Math.max(0.22, (1.1 - this.cfg.world * 0.06) * this.diff.spawnRateMul)
      }
    }
    for (const a of this.aliens) {
      a.t += dt
      a.x = a.baseX + Math.sin(a.t * 1.6) * 60
      a.baseX += a.vx * dt
      if (a.baseX < 40 || a.baseX > W - 40) a.vx *= -1
      a.y += a.vy * dt * 0.6
      if (a.y > ENEMY_FLOOR) a.y = ENEMY_FLOOR // stay out of the bottom buffer
      a.fireCd -= dt
      if (a.fireCd <= 0 && a.y > 0) {
        a.fireCd = (1.5 + Math.random() * 2.5) * this.diff.enemyFireMul
        const dx = this.px - a.x, dy = this.py - a.y
        const d = Math.hypot(dx, dy) || 1
        const sp = (180 + this.cfg.world * 8) * this.diff.bulletSpeedMul
        this.ebullets.push({ x: a.x, y: a.y + a.h / 2, vx: (dx / d) * sp, vy: (dy / d) * sp, r: 5 })
        audio.enemyShoot()
      }
    }

    // Boss
    if (this.boss) this.updateBoss(dt)

    // Asteroids (hazards to shoot or dodge; they pass through the bottom buffer)
    if (this.asteroidsActive()) {
      this.asteroidTimer -= dt
      if (this.asteroidTimer <= 0 && this.asteroids.length < 6) {
        this.spawnAsteroid()
        const base = this.cfg.level === 0 ? 2.6 : 3.4 - this.cfg.world * 0.12
        this.asteroidTimer = Math.max(0.8, base * this.diff.spawnRateMul) + Math.random() * 1.2
      }
    }
    for (const a of this.asteroids) {
      a.x += a.vx * dt
      a.y += a.vy * dt
      a.rot += a.spin * dt
      if (a.x < a.r || a.x > W - a.r) a.vx *= -1
    }
    this.asteroids = this.asteroids.filter((a) => a.y < H + a.r + 20)

    // Space mines: slow drifting bombs that explode on contact or when their fuse burns out
    for (const m of this.mines) {
      m.pulse += dt
      // drift slowly, gently steering toward the player
      const dx = this.px - m.x
      m.vx += Math.sign(dx) * 12 * dt
      m.vx = Math.max(-70, Math.min(70, m.vx))
      m.x += m.vx * dt
      m.y += m.vy * dt
      if (m.y > ENEMY_FLOOR) m.vy = Math.min(m.vy, 20) // linger near the floor rather than leaving
      m.fuse -= dt
      if (m.fuse <= 0) m.hp = 0
    }
    for (const m of this.mines) if (m.hp <= 0) this.explodeMine(m)
    this.mines = this.mines.filter((m) => m.hp > 0 && m.y < H + 40)

    // Enemy bullets (some boss orbs home in on the player)
    for (const e of this.ebullets) {
      if (e.homing) {
        const dx = this.px - e.x, dy = this.py - e.y
        const d = Math.hypot(dx, dy) || 1
        const sp = Math.hypot(e.vx, e.vy) || 1
        e.vx += ((dx / d) * sp - e.vx) * Math.min(1, dt * 1.8)
        e.vy += ((dy / d) * sp - e.vy) * Math.min(1, dt * 1.8)
      }
      e.x += e.vx * dt
      e.y += e.vy * dt
    }
    this.ebullets = this.ebullets.filter((e) => e.y < H + 20 && e.y > -20 && e.x > -20 && e.x < W + 20)

    // Gems
    for (const g of this.gems) {
      g.t += dt
      g.vy += 30 * dt
      g.x += g.vx * dt
      g.y += g.vy * dt
      if (g.x < 12 || g.x > W - 12) g.vx *= -1
    }
    this.gems = this.gems.filter((g) => g.y < H + 20)

    // Particles
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
    for (const f of this.floats) { f.y -= 30 * dt; f.life -= dt }
    this.floats = this.floats.filter((f) => f.life > 0)

    this.handleCollisions()
    this.checkStageEnd()
    this.emitHud()
  }

  private updateBoss(dt: number) {
    const boss = this.boss!
    boss.t += dt
    if (boss.flash > 0) boss.flash -= dt
    boss.x += boss.dir * (70 + this.cfg.world * 6) * this.diff.enemySpeedMul * dt
    if (boss.x < 90) { boss.x = 90; boss.dir = 1 }
    if (boss.x > W - 90) { boss.x = W - 90; boss.dir = -1 }
    boss.y = 110 + Math.sin(boss.t * 0.8) * 30

    boss.fireCd -= dt
    if (boss.fireCd <= 0) {
      boss.fireCd = this.fireBossWeapon(boss)
      audio.enemyShoot()
    }

    boss.spawnCd -= dt
    const bossMinionCap = Math.max(2, Math.round(3 * this.diff.maxConcurrentMul))
    if (boss.spawnCd <= 0 && this.aliens.length < bossMinionCap && boss.weapon !== 'mines') {
      boss.spawnCd = 4 * this.diff.spawnRateMul
      this.spawnAlien()
    }
  }

  /** Each boss has a signature attack. Returns the cooldown until the next volley. */
  private fireBossWeapon(boss: Boss): number {
    const ox = boss.x, oy = boss.y + boss.h / 2
    const sp = (170 + this.cfg.world * 9) * this.diff.bulletSpeedMul
    const fireMul = this.diff.enemyFireMul
    const shoot = (vx: number, vy: number, r = 6) => this.ebullets.push({ x: ox, y: oy, vx, vy, r })
    const aimAt = (mult = 1) => {
      const dx = this.px - ox, dy = this.py - oy
      const d = Math.hypot(dx, dy) || 1
      return { vx: (dx / d) * sp * mult, vy: (dy / d) * sp * mult }
    }
    switch (boss.weapon) {
      case 'spread': {
        const n = 5 + Math.floor(this.cfg.world / 2)
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.22
          shoot(Math.cos(a) * sp, Math.sin(a) * sp)
        }
        return Math.max(0.35, 1.3 * fireMul)
      }
      case 'aimed': {
        // tight targeted burst
        const { vx, vy } = aimAt(1.25)
        shoot(vx, vy, 7)
        shoot(vx * 0.96, vy * 0.96, 5)
        shoot(vx * 1.04, vy * 1.04, 5)
        return Math.max(0.28, 0.9 * fireMul)
      }
      case 'spiral': {
        boss.ang += 0.5
        const arms = 3
        for (let k = 0; k < arms; k++) {
          const a = boss.ang + (k / arms) * Math.PI * 2
          shoot(Math.cos(a) * sp, Math.sin(a) * sp)
        }
        return Math.max(0.1, 0.16 * fireMul)
      }
      case 'ring': {
        const n = 12 + this.cfg.world
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + boss.t
          shoot(Math.cos(a) * sp, Math.sin(a) * sp)
        }
        return Math.max(0.7, 1.8 * fireMul)
      }
      case 'shotgun': {
        for (let i = 0; i < 10; i++) {
          const a = Math.PI / 2 + (Math.random() - 0.5) * 1.1
          const s = sp * (0.7 + Math.random() * 0.6)
          shoot(Math.cos(a) * s, Math.sin(a) * s, 4 + Math.random() * 3)
        }
        return Math.max(0.5, 1.5 * fireMul)
      }
      case 'homing': {
        // slow orbs that curve toward the player
        const { vx, vy } = aimAt(0.55)
        this.ebullets.push({ x: ox, y: oy, vx, vy, r: 8, homing: true })
        return Math.max(0.5, 1.2 * fireMul)
      }
      case 'sweep': {
        // a horizontal wall of bullets that sweeps across
        boss.ang += 0.4
        const off = Math.sin(boss.ang) * 0.5
        for (let i = -3; i <= 3; i++) {
          const a = Math.PI / 2 + i * 0.16 + off
          shoot(Math.cos(a) * sp, Math.sin(a) * sp, 5)
        }
        return Math.max(0.18, 0.4 * fireMul)
      }
      case 'mines': {
        // lay slow-drifting exploding mines, with the occasional aimed shot
        this.spawnMine(ox, oy + 8)
        if (Math.random() < 0.5) { const { vx, vy } = aimAt(1); shoot(vx, vy, 6) }
        return Math.max(0.9, 2.2 * fireMul)
      }
    }
    return 1
  }

  private nearestEnemy(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null
    let bd = Infinity
    for (const a of this.aliens) {
      const d = Math.hypot(a.x - x, a.y - y)
      if (d < bd) { bd = d; best = a }
    }
    if (this.boss) {
      const d = Math.hypot(this.boss.x - x, this.boss.y - y)
      if (d < bd) best = this.boss
    }
    return best
  }

  // ---- Collisions ----
  private handleCollisions() {
    // player bullets vs aliens
    for (const b of this.bullets) {
      for (const a of this.aliens) {
        if (a.hp <= 0) continue
        if (b.hits.has(a.id)) continue
        if (Math.abs(b.x - a.x) < a.w / 2 + b.r && Math.abs(b.y - a.y) < a.h / 2 + b.r) {
          a.hp -= b.dmg
          b.hits.add(a.id)
          this.spawnParticles(b.x, b.y, a.type === 2 ? '#ff9e5e' : '#5ef0ff', 4)
          if (!b.pierce) { b.y = -999; break }
        }
      }
      if (this.boss && b.hits.has(this.boss.id) === false && this.boss.hp > 0) {
        const bs = this.boss
        if (Math.abs(b.x - bs.x) < bs.w / 2 + b.r && Math.abs(b.y - bs.y) < bs.h / 2 + b.r) {
          bs.hp -= b.dmg
          bs.flash = 0.08
          b.hits.add(bs.id)
          audio.bossHit()
          this.spawnParticles(b.x, b.y, bs.color, 3)
          if (!b.pierce) b.y = -999
        }
      }
    }

    // dead aliens
    for (const a of this.aliens) {
      if (a.hp <= 0) {
        this.kills++
        this.killedThisStage++
        this.score += a.points
        this.addFloat(a.x, a.y, `+${a.points}`, '#ffd65e')
        this.spawnParticles(a.x, a.y, '#ffb347', 14)
        audio.explosion()
        if (Math.random() < 0.55) this.dropGem(a.x, a.y)
      }
    }
    this.aliens = this.aliens.filter((a) => a.hp > 0)

    // player bullets vs asteroids
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (a.hp <= 0) continue
        if (b.hits.has(a.id)) continue
        if (Math.hypot(b.x - a.x, b.y - a.y) < a.r + b.r) {
          a.hp -= b.dmg
          b.hits.add(a.id)
          this.spawnParticles(b.x, b.y, '#c9b8a0', 4)
          if (!b.pierce) { b.y = -999; break }
        }
      }
    }
    for (const a of this.asteroids) {
      if (a.hp <= 0) {
        const pts = 40 + Math.round(a.r * 4)
        this.score += pts
        this.addFloat(a.x, a.y, `+${pts}`, '#c9b8a0')
        this.spawnParticles(a.x, a.y, '#a89880', Math.round(a.r))
        audio.explosion()
      }
    }
    this.asteroids = this.asteroids.filter((a) => a.hp > 0)

    // player bullets vs mines (shooting one detonates it — mind the shrapnel)
    for (const b of this.bullets) {
      for (const m of this.mines) {
        if (m.hp <= 0) continue
        if (b.hits.has(m.id)) continue
        if (Math.hypot(b.x - m.x, b.y - m.y) < m.r + b.r) {
          m.hp -= b.dmg
          b.hits.add(m.id)
          if (m.hp <= 0) { this.score += 60; this.addFloat(m.x, m.y, '+60', '#ff8a5e') }
          if (!b.pierce) { b.y = -999; break }
        }
      }
    }
    // (explosions happen in the update loop when hp hits 0)

    // player lasers shoot down incoming enemy fire
    for (const b of this.bullets) {
      if (b.y < -900) continue
      for (const e of this.ebullets) {
        if (e.dead) continue
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r + 1) {
          e.dead = true
          this.score += 5
          this.spawnParticles(e.x, e.y, '#ffd65e', 5)
          if (!b.pierce) { b.y = -999; break }
        }
      }
    }
    this.ebullets = this.ebullets.filter((e) => !e.dead)

    this.bullets = this.bullets.filter((b) => b.y > -900)

    // boss death handled in checkStageEnd

    // hazards vs player
    if (this.invuln <= 0) {
      for (const e of this.ebullets) {
        if (Math.hypot(e.x - this.px, e.y - this.py) < e.r + 16) {
          this.hurtPlayer()
          break
        }
      }
      // mine contact detonates it on the player
      for (const m of this.mines) {
        if (Math.hypot(m.x - this.px, m.y - this.py) < m.r + 15) {
          m.hp = 0
          this.hurtPlayer()
          break
        }
      }
      // alien body vs player
      for (const a of this.aliens) {
        if (Math.abs(a.x - this.px) < a.w / 2 + 14 && Math.abs(a.y - this.py) < a.h / 2 + 14) {
          this.hurtPlayer()
          break
        }
      }
      // asteroid vs player (destroys the asteroid and shatters the shield)
      for (const a of this.asteroids) {
        if (Math.hypot(a.x - this.px, a.y - this.py) < a.r + 14) {
          this.spawnParticles(a.x, a.y, '#a89880', Math.round(a.r))
          a.hp = 0
          this.hurtPlayer(true)
          break
        }
      }
      this.asteroids = this.asteroids.filter((a) => a.hp > 0)
      if (this.boss && Math.abs(this.boss.x - this.px) < this.boss.w / 2 + 14 &&
        Math.abs(this.boss.y - this.py) < this.boss.h / 2 + 14) {
        this.hurtPlayer()
      }
    }

    // gems vs player
    for (const g of this.gems) {
      if (Math.hypot(g.x - this.px, g.y - this.py) < g.r + 20) {
        this.collectGem(g)
        g.y = H + 999
      }
    }
    this.gems = this.gems.filter((g) => g.y < H + 100)
  }

  private hurtPlayer(wipeShield = false) {
    // Shields soak up hits first; only when depleted do you lose a life.
    // An asteroid impact (wipeShield) shatters the whole shield at once.
    if (this.shield > 0) {
      this.shield = wipeShield ? 0 : Math.max(0, this.shield - SHIELD_HIT_COST)
      this.invuln = wipeShield ? 1.4 : 0.8
      audio.bossHit()
      this.spawnParticles(this.px, this.py, '#5ef0ff', wipeShield ? 24 : 12)
      this.addFloat(this.px, this.py - 26, wipeShield ? 'SHIELDS DOWN!' : 'SHIELD', '#5ef0ff')
      return
    }
    this.lives--
    this.invuln = 2
    audio.playerHit()
    this.spawnParticles(this.px, this.py, '#ff5e5e', 24)
    // clear nearby enemy bullets so respawn isn't instant death
    this.ebullets = this.ebullets.filter((e) => Math.hypot(e.x - this.px, e.y - this.py) > 120)
    if (this.lives <= 0) this.endStage('gameOver')
  }

  private dropGem(x: number, y: number) {
    const key = GEM_DROP_POOL[Math.floor(Math.random() * GEM_DROP_POOL.length)]
    const def = GEMS[key]
    this.gems.push({
      id: key, x, y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 40,
      r: 10, t: Math.random() * 6, color: def.color, points: def.points,
      ammo: def.ammo, life: def.life,
    })
    // occasional shield recharge cell
    if (Math.random() < 0.12) {
      const sh = GEMS.shield
      this.gems.push({
        id: 'shield', x: x - 14, y, vx: (Math.random() - 0.5) * 40, vy: -50,
        r: 11, t: 0, color: sh.color, points: sh.points, shield: true,
      })
    }
    // rare med-kit
    if (Math.random() < 0.03) {
      const life = GEMS.life
      this.gems.push({
        id: 'life', x: x + 14, y, vx: (Math.random() - 0.5) * 40, vy: -60,
        r: 11, t: 0, color: life.color, points: 0, life: true,
      })
    }
  }

  private collectGem(g: Gem) {
    this.gemsCollected++
    this.score += g.points
    if (g.life) {
      this.lives++
      audio.life()
      this.addFloat(g.x, g.y, '+1 LIFE', '#ff5e5e')
    } else if (g.shield) {
      this.shield = Math.min(MAX_SHIELD, this.shield + SHIELD_GEM_RESTORE)
      audio.powerup()
      this.addFloat(g.x, g.y, '+SHIELD', '#5ef0ff')
    } else if (g.ammo) {
      this.ammoType = g.ammo
      this.ammoCount = AMMO_START[g.ammo]
      audio.powerup()
      this.addFloat(g.x, g.y, GEMS[g.id].name, g.color)
    } else {
      audio.gem()
      this.addFloat(g.x, g.y, `+${g.points}`, g.color)
    }
    this.spawnParticles(g.x, g.y, g.color, 8)
  }

  // ---- Stage end ----
  private checkStageEnd() {
    if (this.awaiting) return
    if (this.cfg.level === 0) {
      if (this.boss && this.boss.hp <= 0) {
        this.spawnParticles(this.boss.x, this.boss.y, this.boss.color, 60)
        audio.bossDefeated()
        this.boss = null
        this.bossesDefeated++
        this.score += Math.round((2000 + this.cfg.world * 500) * this.diff.scoreMul)
        this.endStage('bossDefeated')
      }
    } else {
      if (this.killedThisStage >= this.quota && this.aliens.length === 0 && this.spawned >= this.quota) {
        audio.levelUp()
        this.score += Math.round((500 + this.cfg.world * 100) * this.diff.scoreMul)
        this.endStage('levelComplete')
      }
    }
  }

  private endStage(type: StageResult['type']) {
    if (this.awaiting) return
    this.awaiting = true
    // time bonus for levels/bosses (not for game over)
    if (type !== 'gameOver') {
      const elapsed = performance.now() - this.stageStartMs
      const bonus = Math.max(0, Math.round((60000 - elapsed) / 1000)) * 5
      this.score += bonus
    }
    if (type === 'gameOver') audio.gameOver()
    const stats = this.getStats()
    // small delay so explosions are visible
    window.setTimeout(() => {
      this.cb.onResult({ type, stats } as StageResult)
    }, type === 'gameOver' ? 900 : 700)
  }

  markWorldCleared() { this.worldsCleared++ }

  // ---- FX ----
  private spawnParticles(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 40 + Math.random() * 220
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.5, maxLife: 0.9, color, size: 1 + Math.random() * 3,
      })
    }
  }
  private addFloat(x: number, y: number, text: string, color: string) {
    this.floats.push({ x, y, text, color, life: 0.9 })
  }

  // ---- HUD emit ----
  private emitHud() {
    const h: HudState = {
      score: this.score, lives: this.lives, gems: this.gemsCollected,
      timeMs: performance.now() - this.stageStartMs,
      blasterName: this.blaster.name,
      ammoType: this.ammoCount > 0 ? this.ammoType : null,
      ammoCount: this.ammoCount,
      levelLabel: this.cfg.level === 0 ? 'BOSS' : `LEVEL ${this.cfg.level}`,
      goalCurrent: Math.min(this.killedThisStage, this.quota),
      goalTarget: this.quota,
      bossHp: this.boss?.hp ?? 0,
      bossMaxHp: this.boss?.maxHp ?? 0,
      bossName: this.boss?.name ?? '',
      paused: this.paused,
    }
    this.cb.onHud(h)
  }

  // ---- Render ----
  private render() {
    const ctx = this.ctx
    const world = WORLDS[this.cfg.world]
    // background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, world.bgTop)
    grad.addColorStop(1, world.bgBottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // stars
    for (const s of this.stars) {
      ctx.globalAlpha = 0.3 + s.z * 0.7
      ctx.fillStyle = '#ffffff'
      const sz = s.z * 2
      ctx.fillRect(s.x, s.y, sz, sz)
    }
    ctx.globalAlpha = 1

    // bottom buffer zone marker (mirrors the top HUD margin)
    ctx.save()
    ctx.strokeStyle = world.accent
    ctx.globalAlpha = 0.18
    ctx.setLineDash([8, 10])
    ctx.beginPath()
    ctx.moveTo(0, ENEMY_FLOOR + 8)
    ctx.lineTo(W, ENEMY_FLOOR + 8)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 0.05
    ctx.fillStyle = world.accent
    ctx.fillRect(0, ENEMY_FLOOR + 8, W, H - (ENEMY_FLOOR + 8))
    ctx.restore()
    ctx.globalAlpha = 1

    // asteroids
    for (const a of this.asteroids) this.drawAsteroid(a)

    // mines
    for (const m of this.mines) this.drawMine(m)

    // gems
    for (const g of this.gems) this.drawGem(g)

    // aliens
    for (const a of this.aliens) this.drawAlien(a)

    // boss
    if (this.boss) this.drawBoss(this.boss)

    // player bullets
    for (const b of this.bullets) {
      ctx.save()
      ctx.shadowBlur = 12
      ctx.shadowColor = b.color
      ctx.fillStyle = b.color
      ctx.beginPath()
      ctx.ellipse(b.x, b.y, b.r, b.r * 2.2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // enemy bullets
    for (const e of this.ebullets) {
      ctx.save()
      ctx.shadowBlur = 10
      ctx.shadowColor = '#ff5e5e'
      ctx.fillStyle = '#ff8a5e'
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x, p.y, p.size, p.size)
    }
    ctx.globalAlpha = 1

    // player
    this.drawPlayer()

    // floats
    ctx.textAlign = 'center'
    ctx.font = 'bold 14px "Courier New", monospace'
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, f.life)
      ctx.fillStyle = f.color
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1

    this.drawHud()

    if (this.stageBanner > 0) {
      ctx.globalAlpha = Math.min(1, this.stageBanner)
      ctx.textAlign = 'center'
      ctx.fillStyle = world.accent
      ctx.font = 'bold 46px "Courier New", monospace'
      const label = this.cfg.level === 0
        ? `BOSS: ${WORLDS[this.cfg.world].bosses[this.cfg.boss].name}`
        : `LEVEL ${this.cfg.level}`
      ctx.fillText(label, W / 2, H / 2 - 10)
      ctx.font = '18px "Courier New", monospace'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(world.name, W / 2, H / 2 + 22)
      ctx.font = '13px "Courier New", monospace'
      ctx.fillStyle = '#9fb0d0'
      ctx.fillText(
        this.touchEnabled ? 'Drag to move · auto-fire while touching' : 'Move: arrows/WASD · Fire: Space',
        W / 2, H / 2 + 48,
      )
      ctx.globalAlpha = 1
    }

    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, W, H)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#5ef0ff'
      ctx.font = 'bold 48px "Courier New", monospace'
      ctx.fillText('PAUSED', W / 2, H / 2)
      ctx.font = '16px "Courier New", monospace'
      ctx.fillStyle = '#ffffff'
      ctx.fillText('Press P or ESC to resume', W / 2, H / 2 + 36)
    }
  }

  private drawPlayer() {
    const ctx = this.ctx
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) return
    ctx.save()
    ctx.translate(this.px, this.py)
    // engine glow
    ctx.shadowBlur = 18
    ctx.shadowColor = this.blaster.color
    // ship body
    ctx.fillStyle = '#dfe9ff'
    ctx.beginPath()
    ctx.moveTo(0, -22)
    ctx.lineTo(16, 16)
    ctx.lineTo(6, 10)
    ctx.lineTo(0, 16)
    ctx.lineTo(-6, 10)
    ctx.lineTo(-16, 16)
    ctx.closePath()
    ctx.fill()
    // cockpit
    ctx.shadowBlur = 0
    ctx.fillStyle = this.blaster.color
    ctx.beginPath()
    ctx.arc(0, -2, 5, 0, Math.PI * 2)
    ctx.fill()
    // thruster flame
    ctx.fillStyle = '#ff9e5e'
    const flame = 8 + Math.random() * 8
    ctx.beginPath()
    ctx.moveTo(-5, 14)
    ctx.lineTo(0, 14 + flame)
    ctx.lineTo(5, 14)
    ctx.closePath()
    ctx.fill()
    // shield bubble (opacity tracks remaining shield)
    if (this.shield > 0) {
      ctx.shadowBlur = 12
      ctx.shadowColor = '#5ef0ff'
      ctx.strokeStyle = '#5ef0ff'
      ctx.globalAlpha = 0.25 + 0.6 * (this.shield / MAX_SHIELD)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, -2, 26, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  private drawAsteroid(a: Asteroid) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(a.x, a.y)
    ctx.rotate(a.rot)
    ctx.shadowBlur = 8
    ctx.shadowColor = '#000000'
    ctx.fillStyle = '#8a7d6b'
    ctx.strokeStyle = '#5a5045'
    ctx.lineWidth = 2
    ctx.beginPath()
    const n = a.shape.length
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2
      const rr = a.r * a.shape[i]
      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // a couple of craters
    ctx.fillStyle = '#6b6155'
    ctx.beginPath()
    ctx.arc(-a.r * 0.25, -a.r * 0.15, a.r * 0.2, 0, Math.PI * 2)
    ctx.arc(a.r * 0.3, a.r * 0.25, a.r * 0.14, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawAlien(a: Alien) {
    const ctx = this.ctx
    const hpFrac = a.hp / a.maxHp
    const s = a.w / 2
    ctx.save()
    ctx.translate(a.x, a.y)
    if (a.type === 0) this.drawEnemyShip(s, a.t)
    else if (a.type === 1) this.drawEnemyAlien(s, a.t)
    else this.drawEnemyMonster(s, a.t)
    ctx.restore()
    // hp bar for tanky enemies
    if (a.maxHp > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(a.x - a.w / 2, a.y - a.h / 2 - 8, a.w, 4)
      ctx.fillStyle = '#5eff8a'
      ctx.fillRect(a.x - a.w / 2, a.y - a.h / 2 - 8, a.w * hpFrac, 4)
    }
  }

  // A metallic alien fighter craft: swept wings, cockpit, engine glow.
  private drawEnemyShip(s: number, t: number) {
    const ctx = this.ctx
    // engine flare (points up — the ship dives at the player)
    ctx.fillStyle = '#5ecbff'
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.moveTo(-s * 0.4, -s * 0.7)
    ctx.lineTo(0, -s * (1.1 + Math.random() * 0.3))
    ctx.lineTo(s * 0.4, -s * 0.7)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.shadowBlur = 8
    ctx.shadowColor = '#8fb8d8'
    // hull (metallic grey with a nose pointing down)
    const g = ctx.createLinearGradient(0, -s, 0, s)
    g.addColorStop(0, '#b8c4d4'); g.addColorStop(1, '#5a6472')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, s)          // nose
    ctx.lineTo(s, -s * 0.2)   // right wing tip
    ctx.lineTo(s * 0.35, -s * 0.6)
    ctx.lineTo(-s * 0.35, -s * 0.6)
    ctx.lineTo(-s, -s * 0.2)  // left wing tip
    ctx.closePath()
    ctx.fill()
    // cockpit (subtle pulse)
    ctx.shadowBlur = 6
    ctx.shadowColor = '#5ef0ff'
    ctx.fillStyle = '#5ef0ff'
    ctx.globalAlpha = 0.75 + 0.25 * Math.abs(Math.sin(t * 3))
    ctx.beginPath()
    ctx.ellipse(0, s * 0.15, s * 0.22, s * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // A fleshy alien: bulbous body, big eye, writhing tentacles.
  private drawEnemyAlien(s: number, t: number) {
    const ctx = this.ctx
    ctx.shadowBlur = 12
    ctx.shadowColor = '#c98aff'
    // tentacles
    ctx.strokeStyle = '#9a5ed8'
    ctx.lineWidth = 3
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(i * s * 0.35, s * 0.3)
      ctx.quadraticCurveTo(i * s * 0.45 + Math.sin(t * 4 + i) * 4, s * 0.9, i * s * 0.3, s * 1.15)
      ctx.stroke()
    }
    // body
    const g = ctx.createRadialGradient(0, -s * 0.2, 2, 0, 0, s)
    g.addColorStop(0, '#e6b8ff'); g.addColorStop(1, '#8a3ad0')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 0.85, s, 0, 0, Math.PI * 2)
    ctx.fill()
    // eye
    ctx.shadowBlur = 0
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a0a2a'
    ctx.beginPath(); ctx.arc(Math.sin(t * 2) * s * 0.12, -s * 0.1, s * 0.18, 0, Math.PI * 2); ctx.fill()
  }

  // A hulking space monster: jagged carapace, horns, gnashing maw.
  private drawEnemyMonster(s: number, t: number) {
    const ctx = this.ctx
    ctx.shadowBlur = 12
    ctx.shadowColor = '#ff7b4a'
    // spiky carapace
    const g = ctx.createRadialGradient(0, -s * 0.2, 2, 0, 0, s * 1.1)
    g.addColorStop(0, '#ffb37a'); g.addColorStop(1, '#a5431f')
    ctx.fillStyle = g
    ctx.beginPath()
    const spikes = 9
    for (let i = 0; i < spikes * 2; i++) {
      const ang = (i / (spikes * 2)) * Math.PI * 2
      const rr = i % 2 === 0 ? s * 1.05 : s * 0.7
      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    // glowing eyes
    ctx.shadowBlur = 8
    ctx.shadowColor = '#ffe45e'
    ctx.fillStyle = '#ffe45e'
    ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.15, s * 0.14, 0, Math.PI * 2)
    ctx.arc(s * 0.3, -s * 0.15, s * 0.14, 0, Math.PI * 2); ctx.fill()
    // maw with teeth
    ctx.shadowBlur = 0
    ctx.fillStyle = '#3a0a05'
    ctx.beginPath(); ctx.ellipse(0, s * 0.35, s * 0.5, s * 0.28 + Math.sin(t * 6) * 2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(i * s * 0.18, s * 0.2)
      ctx.lineTo(i * s * 0.18 + s * 0.07, s * 0.42)
      ctx.lineTo(i * s * 0.18 - s * 0.07, s * 0.42)
      ctx.closePath(); ctx.fill()
    }
  }

  private drawMine(m: Mine) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(m.x, m.y)
    ctx.shadowBlur = 10
    ctx.shadowColor = '#ff5e5e'
    // spikes
    ctx.strokeStyle = '#6b6155'
    ctx.lineWidth = 3
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + m.pulse * 0.6
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * m.r * 0.7, Math.sin(a) * m.r * 0.7)
      ctx.lineTo(Math.cos(a) * m.r * 1.35, Math.sin(a) * m.r * 1.35)
      ctx.stroke()
    }
    // body
    ctx.fillStyle = '#3a3630'
    ctx.beginPath(); ctx.arc(0, 0, m.r, 0, Math.PI * 2); ctx.fill()
    // blinking warning light — faster as the fuse runs down
    const blink = (Math.sin(m.pulse * (m.fuse < 1.5 ? 22 : 8)) + 1) / 2
    ctx.fillStyle = `rgba(255,${Math.round(60 + blink * 60)},60,${0.4 + blink * 0.6})`
    ctx.shadowBlur = 12
    ctx.shadowColor = '#ff3a3a'
    ctx.beginPath(); ctx.arc(0, 0, m.r * 0.4, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  private drawBoss(b: Boss) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.shadowBlur = 24
    ctx.shadowColor = b.color
    const body = b.flash > 0 ? '#ffffff' : b.color
    switch (b.kind) {
      case 'saucer': this.drawBossSaucer(b, body); break
      case 'warship': this.drawBossWarship(b, body); break
      case 'monster': this.drawBossMonster(b, body); break
      case 'alien': this.drawBossAlien(b, body); break
    }
    ctx.restore()
  }

  private lighten(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.min(255, ((n >> 16) & 255) + amt)
    const g = Math.min(255, ((n >> 8) & 255) + amt)
    const bl = Math.min(255, (n & 255) + amt)
    return `rgb(${r},${g},${bl})`
  }

  // Big flying saucer: domed cockpit, wide metallic disc, ring of blinking lights.
  private drawBossSaucer(b: Boss, body: string) {
    const ctx = this.ctx
    const w = b.w / 2, h = b.h / 2
    // underside glow
    ctx.shadowBlur = 30
    ctx.shadowColor = body
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.beginPath(); ctx.ellipse(0, h * 0.7, w * 0.6, h * 0.5, 0, 0, Math.PI * 2); ctx.fill()
    // disc
    const g = ctx.createLinearGradient(0, -h, 0, h)
    g.addColorStop(0, this.lighten(body === '#ffffff' ? '#888888' : body, 40))
    g.addColorStop(1, '#3a3f4a')
    ctx.fillStyle = g
    ctx.shadowBlur = 20
    ctx.beginPath(); ctx.ellipse(0, 0, w, h * 0.55, 0, 0, Math.PI * 2); ctx.fill()
    // dome
    ctx.fillStyle = body
    ctx.globalAlpha = 0.85
    ctx.beginPath(); ctx.ellipse(0, -h * 0.15, w * 0.42, h * 0.7, 0, Math.PI, 0); ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath(); ctx.ellipse(-w * 0.12, -h * 0.4, w * 0.12, h * 0.22, 0, 0, Math.PI * 2); ctx.fill()
    // ring of lights
    ctx.shadowBlur = 8
    for (let i = 0; i < 9; i++) {
      const on = (Math.sin(b.t * 5 + i) + 1) / 2 > 0.4
      ctx.fillStyle = on ? '#ffe45e' : '#5a4a20'
      ctx.shadowColor = '#ffe45e'
      const lx = -w * 0.85 + (i / 8) * w * 1.7
      ctx.beginPath(); ctx.arc(lx, h * 0.18, 4, 0, Math.PI * 2); ctx.fill()
    }
  }

  // Big winged warship: angular hull, swept wings, engine burn, bridge & weapon pods.
  private drawBossWarship(b: Boss, body: string) {
    const ctx = this.ctx
    const w = b.w / 2, h = b.h / 2
    // engine burn (top — faces away from the player)
    ctx.fillStyle = '#5ecbff'
    ctx.globalAlpha = 0.8
    for (const ex of [-w * 0.35, w * 0.35]) {
      ctx.beginPath()
      ctx.moveTo(ex - 7, -h * 0.7)
      ctx.lineTo(ex, -h * (1.1 + Math.random() * 0.25))
      ctx.lineTo(ex + 7, -h * 0.7)
      ctx.closePath(); ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 16
    ctx.shadowColor = body
    // wings
    const g = ctx.createLinearGradient(0, -h, 0, h)
    g.addColorStop(0, this.lighten(body === '#ffffff' ? '#888' : body, 30))
    g.addColorStop(1, '#3a3f4a')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, h)                 // nose (points at player)
    ctx.lineTo(w, -h * 0.1)          // right wingtip
    ctx.lineTo(w * 0.55, -h * 0.6)
    ctx.lineTo(w * 0.25, -h * 0.7)
    ctx.lineTo(-w * 0.25, -h * 0.7)
    ctx.lineTo(-w * 0.55, -h * 0.6)
    ctx.lineTo(-w, -h * 0.1)         // left wingtip
    ctx.closePath(); ctx.fill()
    // central spine
    ctx.fillStyle = '#2a2f38'
    ctx.beginPath()
    ctx.moveTo(0, h); ctx.lineTo(w * 0.18, -h * 0.6); ctx.lineTo(-w * 0.18, -h * 0.6)
    ctx.closePath(); ctx.fill()
    // bridge glow + wingtip guns
    ctx.shadowBlur = 8
    ctx.shadowColor = body
    ctx.fillStyle = body
    ctx.beginPath(); ctx.ellipse(0, -h * 0.1, w * 0.1, h * 0.22, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ff8a5e'
    ctx.beginPath(); ctx.arc(w * 0.92, -h * 0.1, 4, 0, Math.PI * 2)
    ctx.arc(-w * 0.92, -h * 0.1, 4, 0, Math.PI * 2); ctx.fill()
  }

  // Hulking space monster: armored carapace, horns, many eyes, gnashing fanged maw.
  private drawBossMonster(b: Boss, body: string) {
    const ctx = this.ctx
    const w = b.w / 2, h = b.h / 2
    ctx.shadowBlur = 18
    ctx.shadowColor = body
    // horns
    ctx.fillStyle = '#e8e0d0'
    for (const hx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(hx * w * 0.55, -h * 0.4)
      ctx.lineTo(hx * w * 0.95, -h * 1.05)
      ctx.lineTo(hx * w * 0.4, -h * 0.7)
      ctx.closePath(); ctx.fill()
    }
    // lumpy carapace
    const g = ctx.createRadialGradient(0, -h * 0.2, 4, 0, 0, w)
    g.addColorStop(0, this.lighten(body === '#ffffff' ? '#aaa' : body, 30))
    g.addColorStop(1, body === '#ffffff' ? '#888' : body)
    ctx.fillStyle = g
    ctx.beginPath()
    const lobes = 11
    for (let i = 0; i <= lobes; i++) {
      const ang = Math.PI + (i / lobes) * Math.PI // top half
      const rr = w * (0.9 + Math.sin(i * 1.7) * 0.12)
      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr * (h / w) - h * 0.05
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.lineTo(w, h * 0.3); ctx.lineTo(-w, h * 0.3)
    ctx.closePath(); ctx.fill()
    // eyes
    ctx.shadowBlur = 10; ctx.shadowColor = '#ffe45e'
    ctx.fillStyle = '#ffe45e'
    for (const ex of [-0.45, -0.15, 0.15, 0.45]) {
      ctx.beginPath(); ctx.arc(ex * w, -h * 0.15, 6, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = '#1a0a05'
    for (const ex of [-0.45, -0.15, 0.15, 0.45]) {
      ctx.beginPath(); ctx.arc(ex * w, -h * 0.15, 2.5, 0, Math.PI * 2); ctx.fill()
    }
    // gnashing maw
    ctx.shadowBlur = 0
    ctx.fillStyle = '#2a0805'
    const gape = h * 0.34 + Math.sin(b.t * 5) * 6
    ctx.beginPath(); ctx.ellipse(0, h * 0.35, w * 0.62, gape, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath()
      ctx.moveTo(i * w * 0.16, h * 0.35 - gape + 2)
      ctx.lineTo(i * w * 0.16 + 6, h * 0.35 - gape * 0.3)
      ctx.lineTo(i * w * 0.16 - 6, h * 0.35 - gape * 0.3)
      ctx.closePath(); ctx.fill()
      ctx.beginPath()
      ctx.moveTo(i * w * 0.16, h * 0.35 + gape - 2)
      ctx.lineTo(i * w * 0.16 + 6, h * 0.35 + gape * 0.3)
      ctx.lineTo(i * w * 0.16 - 6, h * 0.35 + gape * 0.3)
      ctx.closePath(); ctx.fill()
    }
  }

  // Giant alien: bulbous translucent head, huge central eye, mass of tentacles.
  private drawBossAlien(b: Boss, body: string) {
    const ctx = this.ctx
    const w = b.w / 2, h = b.h / 2
    ctx.shadowBlur = 16
    ctx.shadowColor = body
    // tentacles
    ctx.strokeStyle = body
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath()
      ctx.moveTo(i * w * 0.22, h * 0.3)
      ctx.quadraticCurveTo(
        i * w * 0.3 + Math.sin(b.t * 3 + i) * 10, h * 1.0,
        i * w * 0.22 + Math.sin(b.t * 2 + i) * 8, h * 1.4,
      )
      ctx.stroke()
    }
    // head
    const g = ctx.createRadialGradient(0, -h * 0.25, 4, 0, 0, w)
    g.addColorStop(0, this.lighten(body === '#ffffff' ? '#ccc' : body, 55))
    g.addColorStop(1, body === '#ffffff' ? '#999' : body)
    ctx.fillStyle = g
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.85, h, 0, 0, Math.PI * 2); ctx.fill()
    // brain ridges
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.ellipse(i * w * 0.18, -h * 0.35, w * 0.12, h * 0.3, 0, 0, Math.PI); ctx.stroke()
    }
    // big eye
    ctx.shadowBlur = 0
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(0, h * 0.05, w * 0.42, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = body
    ctx.beginPath(); ctx.arc(0, h * 0.05, w * 0.28, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#0a0512'
    ctx.beginPath(); ctx.arc(Math.sin(b.t * 1.5) * w * 0.1, h * 0.05, w * 0.13, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.beginPath(); ctx.arc(-w * 0.06, h * 0.05 - w * 0.06, w * 0.05, 0, Math.PI * 2); ctx.fill()
  }

  private drawGem(g: Gem) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(g.x, g.y)
    ctx.rotate(g.t * 2)
    ctx.shadowBlur = 14
    ctx.shadowColor = g.color
    ctx.fillStyle = g.color
    if (g.life) {
      // med cross
      ctx.fillRect(-g.r / 3, -g.r, (g.r / 3) * 2, g.r * 2)
      ctx.fillRect(-g.r, -g.r / 3, g.r * 2, (g.r / 3) * 2)
    } else if (g.shield) {
      // shield crest
      ctx.rotate(-g.t * 2) // keep the crest upright
      ctx.beginPath()
      ctx.moveTo(0, -g.r)
      ctx.lineTo(g.r, -g.r * 0.4)
      ctx.lineTo(g.r * 0.7, g.r * 0.7)
      ctx.lineTo(0, g.r)
      ctx.lineTo(-g.r * 0.7, g.r * 0.7)
      ctx.lineTo(-g.r, -g.r * 0.4)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(5,10,20,0.75)'
      ctx.fillRect(-g.r / 4, -g.r * 0.5, g.r / 2, g.r * 1.1)
      ctx.fillRect(-g.r * 0.55, -g.r * 0.08, g.r * 1.1, g.r / 3)
    } else {
      ctx.beginPath()
      ctx.moveTo(0, -g.r)
      ctx.lineTo(g.r, 0)
      ctx.lineTo(0, g.r)
      ctx.lineTo(-g.r, 0)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.moveTo(0, -g.r / 2)
      ctx.lineTo(g.r / 3, 0)
      ctx.lineTo(0, g.r / 3)
      ctx.lineTo(-g.r / 3, 0)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  private drawHud() {
    const ctx = this.ctx
    ctx.save()
    // top bar
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(0, 0, W, 40)
    ctx.textAlign = 'left'
    ctx.font = 'bold 16px "Courier New", monospace'
    ctx.fillStyle = '#5ef0ff'
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 12, 20)

    // shield bar under the score
    const sbW = 150, sbX = 12, sbY = 28
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(sbX, sbY, sbW, 6)
    ctx.fillStyle = this.shield > 0 ? '#5ef0ff' : '#3a4a63'
    ctx.fillRect(sbX, sbY, sbW * (this.shield / MAX_SHIELD), 6)
    ctx.strokeStyle = 'rgba(94,240,255,0.5)'
    ctx.lineWidth = 1
    ctx.strokeRect(sbX, sbY, sbW, 6)
    ctx.font = '9px "Courier New", monospace'
    ctx.fillStyle = '#7ec8ff'
    ctx.fillText('SHIELD', sbX + sbW + 6, sbY + 6)

    // lives as ships
    ctx.font = 'bold 16px "Courier New", monospace'
    ctx.fillStyle = '#ff9e5e'
    for (let i = 0; i < Math.min(this.lives, 6); i++) {
      const lx = 250 + i * 22
      ctx.beginPath()
      ctx.moveTo(lx, 12)
      ctx.lineTo(lx + 7, 28)
      ctx.lineTo(lx - 7, 28)
      ctx.closePath()
      ctx.fill()
    }
    if (this.lives > 6) {
      ctx.fillText(`x${this.lives}`, 250 + 6 * 22, 26)
    }

    // gems
    ctx.textAlign = 'center'
    ctx.fillStyle = '#7ee8ff'
    ctx.fillText(`◆ ${this.gemsCollected}`, W / 2 - 60, 26)

    // timer
    const secs = ((performance.now() - this.stageStartMs) / 1000)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${secs.toFixed(1)}s`, W / 2 + 40, 26)

    // blaster + ammo (right)
    ctx.textAlign = 'right'
    ctx.fillStyle = this.blaster.color
    ctx.fillText(this.blaster.name, W - 12, 18)
    if (this.ammoCount > 0 && this.ammoType) {
      ctx.fillStyle = '#ffe45e'
      ctx.font = '12px "Courier New", monospace'
      ctx.fillText(`${this.ammoType.toUpperCase()} x${this.ammoCount}`, W - 12, 34)
    } else {
      ctx.fillStyle = '#8899aa'
      ctx.font = '11px "Courier New", monospace'
      ctx.fillText('Q/E switch · 1-9 select', W - 12, 34)
    }

    // level goal / boss hp
    if (this.cfg.level === 0 && this.boss) {
      const bw = W - 200
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(100, 48, bw, 16)
      ctx.fillStyle = this.boss.color
      ctx.fillRect(100, 48, bw * (this.boss.hp / this.boss.maxHp), 16)
      ctx.strokeStyle = '#ffffff'
      ctx.strokeRect(100, 48, bw, 16)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px "Courier New", monospace'
      ctx.fillText(`${this.boss.name} — ${this.boss.title}`, W / 2, 60)
    } else if (this.cfg.level !== 0) {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffd65e'
      ctx.font = '12px "Courier New", monospace'
      ctx.fillText(`${this.cfg.level ? `LEVEL ${this.cfg.level}` : ''}  —  Aliens ${Math.min(this.killedThisStage, this.quota)}/${this.quota}`, W / 2, 58)
    }
    ctx.restore()
  }
}
