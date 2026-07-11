// Tiny synthesized retro sound engine using the Web Audio API.
// No audio assets required — everything is generated from oscillators.

type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle'

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private musicTimer: number | null = null
  muted = false
  musicOn = true

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.12
      this.musicGain.connect(this.master)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** Must be called from a user gesture to unlock audio on some browsers. */
  unlock() {
    this.ensure()
  }

  private blip(
    freq: number,
    dur: number,
    type: WaveType = 'square',
    vol = 0.3,
    slideTo?: number,
    dest?: AudioNode,
  ) {
    const ctx = this.ensure()
    if (!ctx || this.muted || !this.master) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), ctx.currentTime + dur)
    }
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    osc.connect(gain)
    gain.connect(dest ?? this.master)
    osc.start()
    osc.stop(ctx.currentTime + dur + 0.02)
  }

  private noise(dur: number, vol = 0.3, filterFreq = 1000) {
    const ctx = this.ensure()
    if (!ctx || this.muted || !this.master) return
    const bufferSize = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start()
    src.stop(ctx.currentTime + dur)
  }

  shoot(pitch = 1) {
    this.blip(760 * pitch, 0.09, 'square', 0.14, 300 * pitch)
  }
  enemyShoot() {
    this.blip(220, 0.12, 'sawtooth', 0.1, 120)
  }
  explosion() {
    this.noise(0.3, 0.35, 900)
    this.blip(140, 0.25, 'sawtooth', 0.2, 40)
  }
  bigExplosion() {
    this.noise(0.6, 0.5, 700)
    this.blip(90, 0.5, 'sawtooth', 0.25, 30)
  }
  gem() {
    this.blip(880, 0.08, 'sine', 0.22, 1320)
  }
  powerup() {
    this.blip(520, 0.09, 'square', 0.2)
    window.setTimeout(() => this.blip(780, 0.09, 'square', 0.2), 70)
    window.setTimeout(() => this.blip(1040, 0.12, 'square', 0.2), 140)
  }
  life() {
    this.blip(660, 0.1, 'triangle', 0.25)
    window.setTimeout(() => this.blip(990, 0.14, 'triangle', 0.25), 90)
  }
  playerHit() {
    this.noise(0.4, 0.4, 500)
    this.blip(200, 0.35, 'sawtooth', 0.25, 60)
  }
  bossHit() {
    this.blip(160, 0.06, 'square', 0.12, 120)
  }
  levelUp() {
    const notes = [523, 659, 784, 1047]
    notes.forEach((n, i) => window.setTimeout(() => this.blip(n, 0.14, 'square', 0.2), i * 90))
  }
  bossDefeated() {
    const notes = [392, 523, 659, 784, 1047, 1319]
    notes.forEach((n, i) => window.setTimeout(() => this.blip(n, 0.18, 'square', 0.22), i * 110))
    window.setTimeout(() => this.bigExplosion(), 200)
  }
  gameOver() {
    const notes = [523, 466, 392, 311, 262]
    notes.forEach((n, i) => window.setTimeout(() => this.blip(n, 0.3, 'sawtooth', 0.22), i * 180))
  }
  uiClick() {
    this.blip(600, 0.05, 'square', 0.12)
  }
  unlock_() {
    this.powerup()
  }

  // Simple looping bassline / arpeggio for background music.
  private musicStep = 0
  startMusic() {
    if (!this.musicOn) return
    const ctx = this.ensure()
    if (!ctx || !this.musicGain) return
    this.stopMusic()
    const bass = [55, 55, 82.4, 65.4, 55, 55, 73.4, 61.7]
    const arp = [220, 329.6, 440, 329.6, 246.9, 329.6, 415.3, 329.6]
    const stepMs = 260
    this.musicStep = 0
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.musicOn) return
      const i = this.musicStep % bass.length
      this.blip(bass[i], stepMs / 1000 * 0.9, 'triangle', 0.5, undefined, this.musicGain!)
      this.blip(arp[i], stepMs / 1000 * 0.5, 'square', 0.25, undefined, this.musicGain!)
      this.musicStep++
    }, stepMs)
  }
  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }

  toggleMute() {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5
    return this.muted
  }
  toggleMusic() {
    this.musicOn = !this.musicOn
    if (this.musicOn) this.startMusic()
    else this.stopMusic()
    return this.musicOn
  }
}

export const audio = new AudioEngine()
