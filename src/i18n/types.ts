// Localization types.
//
// `ui` is a fixed, fully-typed set of keys — TypeScript fails the build if a
// language file forgets one. `content` translates game data (world names, boss
// titles, blaster names, gem names, difficulty blurbs) keyed by the English
// source string, so a missing entry falls back to English instead of breaking.

export type Lang = 'en' | 'fr' | 'it' | 'pt' | 'no' | 'sv' | 'es' | 'ja'

export interface LangMeta {
  code: Lang
  /** The language's own name, as a speaker would write it. */
  label: string
  flag: string
}

export const LANGUAGES: LangMeta[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'no', label: 'Norsk', flag: '🇳🇴' },
  { code: 'sv', label: 'Svenska', flag: '🇸🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
]

/** Every piece of chrome text in the game. Placeholders look like {n}. */
export interface Ui {
  // --- Title screen ---
  tagline: string
  startGame: string
  leaderboard: string
  difficulty: string
  bestScore: string
  worldsUnlocked: string
  blastersOwned: string
  touchControls: string
  on: string
  off: string
  language: string
  admin: string
  adminOn: string
  password: string
  unlock: string
  wrongPassword: string
  adminNote: string
  touchLabel: string
  touchHint: string
  controlsLabel: string
  controlsHint: string

  // --- Sector map ---
  selectSector: string
  quit: string
  armory: string
  locked: string
  cleared: string
  bossesProgress: string
  jumpToEndgame: string
  adminMapHint: string
  mapHint: string

  // --- Boss select ---
  pickTarget: string
  mapBack: string
  bossMeta: string
  defeated: string
  engage: string

  // --- Armory ---
  back: string
  armoryHint: string
  dmg: string
  rate: string
  equipped: string
  equip: string
  clearSector: string

  // --- In-play overlay ---
  sound: string
  music: string
  pause: string
  quitToMenu: string
  switchBlaster: string
  swap: string

  // --- Level complete ---
  levelCleared: string
  score: string
  gems: string
  aliensBlasted: string
  bossApproaching: string
  nextLevel: string
  faceTheBoss: string
  continueOn: string

  // --- Boss defeated ---
  bossDestroyed: string
  totalScore: string
  rewardsUnlocked: string
  newSector: string
  newBlaster: string
  sectorMap: string
  nextTarget: string

  // --- Omega Titan intro ---
  titanAwakens: string
  titanIntro: string
  oneFinalBattle: string
  titanNote: string
  enterThrone: string

  // --- Vorathrax intro ---
  dragonUncoils: string
  dragonIntro: string
  hull: string
  phase1: string
  phase2: string
  phase1Value: string
  phase2Value: string
  beamsKill: string
  dragonNote: string
  faceTheDragon: string

  // --- Victory ---
  galaxySaved: string
  victoryText: string
  finalScore: string
  time: string
  minutes: string
  recordName: string

  // --- Game over ---
  gameOver: string
  difficultyLabel: string
  newBest: string
  gemsCollected: string
  bossesDefeatedStat: string
  timeSurvived: string
  enterPilotName: string
  anonymousPilot: string
  submitting: string
  submitScore: string
  adminRunNote: string
  viewLeaderboard: string

  // --- Leaderboard ---
  loading: string
  noScores: string
  globalScores: string
  localScores: string

  // --- Canvas HUD + floating combat text ---
  hudScore: string
  hudShield: string
  hudAdmin: string
  hudLevel: string
  hudBoss: string
  hudAliens: string
  hudPaused: string
  hudResume: string
  hudControlsKb: string
  hudControlsTouch: string
  hudBossBanner: string
  hudSwitchHint: string
  fxShield: string
  fxShieldsDown: string
  fxLife: string
  fxShieldPickup: string
  fxVaporized: string
  fxEnraged: string
  fxBeamsOnline: string
  hudBeamsFiring: string
  hudBeamsRecharging: string
}

export interface Dict {
  ui: Ui
  /** Game data translations, keyed by the English source string. */
  content: Record<string, string>
}
