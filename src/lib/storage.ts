// Local persistence of player progress across runs.

import { BLASTERS } from '../game/content'
import type { Progress } from '../game/types'

const KEY = 'cosmic-crusade-progress-v1'

export function defaultProgress(): Progress {
  return {
    unlockedWorld: 0,
    defeatedBosses: {},
    blasters: [BLASTERS[0].id],
    bestScore: 0,
  }
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultProgress()
    const p = JSON.parse(raw) as Partial<Progress>
    const base = defaultProgress()
    return {
      unlockedWorld: p.unlockedWorld ?? base.unlockedWorld,
      defeatedBosses: p.defeatedBosses ?? base.defeatedBosses,
      blasters: p.blasters && p.blasters.length ? p.blasters : base.blasters,
      bestScore: p.bestScore ?? base.bestScore,
    }
  } catch {
    return defaultProgress()
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // ignore quota / private-mode errors
  }
}
