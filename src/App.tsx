import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import GameCanvas from './components/GameCanvas'
import { GameEngine } from './game/engine'
import { audio } from './game/audio'
import {
  BLASTERS, BOSSES_TO_ADVANCE, TOTAL_WORLDS, WORLDS, bossKey,
} from './game/content'
import type { HudState, Progress, StageConfig, StageResult } from './game/types'
import { loadProgress, saveProgress } from './lib/storage'
import { fetchTop, submitScore, type ScoreRow } from './lib/leaderboard'

type Screen =
  | 'title' | 'worldMap' | 'bossSelect' | 'armory'
  | 'playing' | 'levelComplete' | 'bossDefeated'
  | 'gameOver' | 'leaderboard' | 'victory'

function countDefeated(progress: Progress, world: number): number {
  let n = 0
  for (let b = 0; b < WORLDS[world].bosses.length; b++) {
    if (progress.defeatedBosses[bossKey(world, b)]) n++
  }
  return n
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [inRun, setInRun] = useState(false)
  const [hud, setHud] = useState<HudState | null>(null)
  const [activeWorld, setActiveWorld] = useState(0)
  const [stage, setStage] = useState<StageConfig>({ world: 0, boss: 0, level: 1 })
  const [pending, setPending] = useState<StageConfig | null>(null)
  const [lastResult, setLastResult] = useState<StageResult | null>(null)
  const [reward, setReward] = useState<{ world?: number; blaster?: string } | null>(null)
  const [muted, setMuted] = useState(false)
  const [musicOn, setMusicOn] = useState(true)

  const engineRef = useRef<GameEngine | null>(null)

  const onEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine
    engine.setOwnedBlasters(progress.blasters)
    engine.pause()
  }, [progress.blasters])

  const onHud = useCallback((h: HudState) => setHud(h), [])

  const beginStage = useCallback((cfg: StageConfig) => {
    setStage(cfg)
    setScreen('playing')
    const e = engineRef.current
    if (e) { e.loadStage(cfg); e.resume() }
  }, [])

  const onResult = useCallback((result: StageResult) => {
    const e = engineRef.current
    if (e) e.pause()
    setLastResult(result)

    if (result.type === 'gameOver') {
      setProgress((p) => {
        const np = { ...p, bestScore: Math.max(p.bestScore, result.stats.score) }
        saveProgress(np)
        return np
      })
      setScreen('gameOver')
      return
    }

    if (result.type === 'levelComplete') {
      const next: StageConfig = stage.level < 3
        ? { ...stage, level: stage.level + 1 }
        : { ...stage, level: 0 } // next up: boss
      setPending(next)
      setScreen('levelComplete')
      return
    }

    if (result.type === 'bossDefeated') {
      setProgress((p) => {
        const defeated = { ...p.defeatedBosses, [bossKey(stage.world, stage.boss)]: true }
        const np: Progress = { ...p, defeatedBosses: defeated }
        const cleared = Object.keys(defeated).filter((k) => k.startsWith(`${stage.world}-`)).length
        let unlockedWorldReward: number | undefined
        let blasterReward: string | undefined
        if (cleared >= BOSSES_TO_ADVANCE && stage.world === p.unlockedWorld) {
          if (stage.world < TOTAL_WORLDS - 1) {
            np.unlockedWorld = stage.world + 1
            unlockedWorldReward = stage.world + 1
          }
          const blaster = BLASTERS.find((b) => b.unlockWorld === stage.world)
          if (blaster && !np.blasters.includes(blaster.id)) {
            np.blasters = [...np.blasters, blaster.id]
            blasterReward = blaster.id
          }
        }
        saveProgress(np)
        setReward(unlockedWorldReward !== undefined || blasterReward
          ? { world: unlockedWorldReward, blaster: blasterReward }
          : null)
        engineRef.current?.setOwnedBlasters(np.blasters)
        if (stage.world === TOTAL_WORLDS - 1 && cleared >= BOSSES_TO_ADVANCE) {
          setScreen('victory')
        } else {
          setScreen('bossDefeated')
        }
        return np
      })
      return
    }
  }, [stage])

  const startRun = useCallback(() => {
    audio.unlock()
    audio.uiClick()
    setInRun(true)
    setActiveWorld(Math.min(progress.unlockedWorld, TOTAL_WORLDS - 1))
    setScreen('worldMap')
  }, [progress.unlockedWorld])

  const quitToTitle = useCallback(() => {
    engineRef.current?.destroy()
    engineRef.current = null
    setInRun(false)
    setHud(null)
    setScreen('title')
  }, [])

  const continueFromLevel = useCallback(() => {
    if (pending) beginStage(pending)
  }, [pending, beginStage])

  const toggleMute = () => setMuted(audio.toggleMute())
  const toggleMusic = () => setMusicOn(audio.toggleMusic())

  const selectBlaster = (id: string) => {
    engineRef.current?.setBlaster(id)
    setHud((h) => (h ? { ...h } : h))
  }

  return (
    <div className="app-root">
      {inRun && (
        <GameCanvas onEngineReady={onEngineReady} onHud={onHud} onResult={onResult} />
      )}

      {screen === 'title' && (
        <TitleScreen progress={progress} onStart={startRun} onLeaderboard={() => setScreen('leaderboard')} />
      )}

      {screen === 'worldMap' && (
        <WorldMap
          progress={progress}
          onSelect={(w) => { audio.uiClick(); setActiveWorld(w); setScreen('bossSelect') }}
          onArmory={() => setScreen('armory')}
          onQuit={quitToTitle}
        />
      )}

      {screen === 'bossSelect' && (
        <BossSelect
          world={activeWorld}
          progress={progress}
          onPick={(b) => beginStage({ world: activeWorld, boss: b, level: 1 })}
          onArmory={() => setScreen('armory')}
          onBack={() => setScreen('worldMap')}
        />
      )}

      {screen === 'armory' && (
        <Armory
          progress={progress}
          activeBlaster={hud?.blasterName}
          onSelect={selectBlaster}
          onBack={() => setScreen(inRun ? 'bossSelect' : 'title')}
        />
      )}

      {screen === 'playing' && hud && (
        <PlayingOverlay hud={hud} muted={muted} musicOn={musicOn}
          onToggleMute={toggleMute} onToggleMusic={toggleMusic}
          onQuit={quitToTitle} />
      )}

      {screen === 'levelComplete' && lastResult && (
        <LevelCompleteOverlay
          stage={stage}
          stats={lastResult.stats}
          nextIsBoss={pending?.level === 0}
          onContinue={continueFromLevel}
        />
      )}

      {screen === 'bossDefeated' && lastResult && (
        <BossDefeatedOverlay
          world={stage.world}
          boss={stage.boss}
          stats={lastResult.stats}
          reward={reward}
          onContinue={() => setScreen('bossSelect')}
          onMap={() => setScreen('worldMap')}
        />
      )}

      {screen === 'victory' && lastResult && (
        <VictoryScreen stats={lastResult.stats} onLeaderboard={() => setScreen('gameOver')} />
      )}

      {screen === 'gameOver' && lastResult && (
        <GameOverScreen
          stats={lastResult.stats}
          bestScore={progress.bestScore}
          onDone={() => setScreen('leaderboard')}
        />
      )}

      {screen === 'leaderboard' && (
        <LeaderboardScreen onBack={() => { if (inRun) quitToTitle(); else setScreen('title') }} />
      )}
    </div>
  )
}

/* ------------------------------ Screens ------------------------------ */

function TitleScreen({ progress, onStart, onLeaderboard }: {
  progress: Progress; onStart: () => void; onLeaderboard: () => void
}) {
  return (
    <div className="screen title-screen">
      <div className="stars-bg" />
      <div className="title-content">
        <h1 className="game-title">COSMIC<span> CRUSADE</span></h1>
        <p className="tagline">Blast aliens across 10 worlds. Collect gems. Topple bosses. Save the galaxy.</p>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={onStart}>▶ START GAME</button>
          <button className="btn" onClick={onLeaderboard}>🏆 LEADERBOARD</button>
        </div>
        <div className="title-stats">
          <span>Best Score: <b>{progress.bestScore.toLocaleString()}</b></span>
          <span>Worlds Unlocked: <b>{progress.unlockedWorld + 1}/{TOTAL_WORLDS}</b></span>
          <span>Blasters: <b>{progress.blasters.length}/{BLASTERS.length}</b></span>
        </div>
        <div className="controls-hint">
          <b>Controls:</b> Arrows / WASD to move · Space to shoot · Q/E or 1–9 to switch blaster · P/Esc to pause
        </div>
      </div>
    </div>
  )
}

function WorldMap({ progress, onSelect, onArmory, onQuit }: {
  progress: Progress
  onSelect: (w: number) => void
  onArmory: () => void
  onQuit: () => void
}) {
  return (
    <div className="screen overlay-screen">
      <div className="panel wide">
        <div className="panel-head">
          <h2>SELECT SECTOR</h2>
          <div className="head-actions">
            <button className="btn small" onClick={onArmory}>🔫 ARMORY</button>
            <button className="btn small ghost" onClick={onQuit}>✕ QUIT</button>
          </div>
        </div>
        <div className="world-grid">
          {WORLDS.map((w, i) => {
            const locked = i > progress.unlockedWorld
            const defeated = countDefeated(progress, i)
            const complete = defeated >= BOSSES_TO_ADVANCE
            return (
              <button
                key={i}
                className={`world-card ${locked ? 'locked' : ''} ${complete ? 'complete' : ''}`}
                style={{ '--accent': w.accent } as CSSProperties}
                disabled={locked}
                onClick={() => onSelect(i)}
              >
                <div className="world-num">{locked ? '🔒' : i + 1}</div>
                <div className="world-name">{w.name}</div>
                <div className="world-sub">{w.subtitle}</div>
                <div className="world-progress">
                  {locked ? 'LOCKED' : complete ? '✓ CLEARED' : `${defeated}/${BOSSES_TO_ADVANCE} bosses`}
                </div>
              </button>
            )
          })}
        </div>
        <p className="hint">Defeat {BOSSES_TO_ADVANCE} of 4 bosses in a sector to unlock the next.</p>
      </div>
    </div>
  )
}

function BossSelect({ world, progress, onPick, onArmory, onBack }: {
  world: number
  progress: Progress
  onPick: (b: number) => void
  onArmory: () => void
  onBack: () => void
}) {
  const w = WORLDS[world]
  return (
    <div className="screen overlay-screen">
      <div className="panel wide" style={{ '--accent': w.accent } as CSSProperties}>
        <div className="panel-head">
          <div>
            <h2>{w.name}</h2>
            <p className="panel-sub">{w.subtitle} · pick a target</p>
          </div>
          <div className="head-actions">
            <button className="btn small" onClick={onArmory}>🔫 ARMORY</button>
            <button className="btn small ghost" onClick={onBack}>← MAP</button>
          </div>
        </div>
        <div className="boss-grid">
          {w.bosses.map((b, i) => {
            const done = progress.defeatedBosses[bossKey(world, i)]
            return (
              <button key={i} className={`boss-card ${done ? 'done' : ''}`}
                style={{ '--bc': b.color } as CSSProperties}
                onClick={() => onPick(i)}>
                <div className="boss-icon">{done ? '☠' : '⬢'}</div>
                <div className="boss-name">{b.name}</div>
                <div className="boss-title">{b.title}</div>
                <div className="boss-meta">3 levels → boss · {b.hp} HP</div>
                <div className="boss-status">{done ? 'DEFEATED' : 'ENGAGE'}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Armory({ progress, activeBlaster, onSelect, onBack }: {
  progress: Progress
  activeBlaster?: string
  onSelect: (id: string) => void
  onBack: () => void
}) {
  return (
    <div className="screen overlay-screen">
      <div className="panel wide">
        <div className="panel-head">
          <h2>🔫 ARMORY</h2>
          <button className="btn small ghost" onClick={onBack}>← BACK</button>
        </div>
        <p className="panel-sub">Toggle your active blaster. Unlock more by clearing sectors.</p>
        <div className="blaster-grid">
          {BLASTERS.map((b) => {
            const owned = progress.blasters.includes(b.id)
            const active = activeBlaster === b.name
            return (
              <button key={b.id}
                className={`blaster-card ${owned ? '' : 'locked'} ${active ? 'active' : ''}`}
                style={{ '--bc': b.color } as CSSProperties}
                disabled={!owned}
                onClick={() => owned && onSelect(b.id)}>
                <div className="blaster-name">{owned ? b.name : '🔒 ' + b.name}</div>
                <div className="blaster-flavor">{b.flavor}</div>
                <div className="blaster-stats">
                  <span>DMG {b.damage}</span>
                  <span>RATE {(1 / b.fireDelay).toFixed(1)}/s</span>
                  <span>{b.pattern.toUpperCase()}</span>
                </div>
                <div className="blaster-unlock">
                  {owned ? (active ? '● EQUIPPED' : 'EQUIP') : `Clear Sector ${b.unlockWorld + 1}`}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PlayingOverlay({ hud, muted, musicOn, onToggleMute, onToggleMusic, onQuit }: {
  hud: HudState
  muted: boolean
  musicOn: boolean
  onToggleMute: () => void
  onToggleMusic: () => void
  onQuit: () => void
}) {
  return (
    <div className="playing-overlay">
      <div className="top-controls">
        <button className="icon-btn" onClick={onToggleMute} title="Sound">{muted ? '🔇' : '🔊'}</button>
        <button className="icon-btn" onClick={onToggleMusic} title="Music">{musicOn ? '🎵' : '🔕'}</button>
        <button className="icon-btn" onClick={onQuit} title="Quit to menu">✕</button>
      </div>
      {hud.paused && <div className="pause-hint" />}
    </div>
  )
}

function LevelCompleteOverlay({ stage, stats, nextIsBoss, onContinue }: {
  stage: StageConfig
  stats: { score: number; gems: number; kills: number }
  nextIsBoss: boolean
  onContinue: () => void
}) {
  return (
    <div className="screen overlay-screen center-modal">
      <div className="panel narrow">
        <h2 className="ok">LEVEL {stage.level} CLEARED</h2>
        <div className="stat-rows">
          <div><span>Score</span><b>{stats.score.toLocaleString()}</b></div>
          <div><span>Gems</span><b>{stats.gems}</b></div>
          <div><span>Aliens blasted</span><b>{stats.kills}</b></div>
        </div>
        <p className="next-up">{nextIsBoss ? '⚠ BOSS APPROACHING' : `Next: Level ${stage.level + 1}`}</p>
        <button className="btn btn-primary" onClick={onContinue}>
          {nextIsBoss ? 'FACE THE BOSS ▶' : 'CONTINUE ▶'}
        </button>
      </div>
    </div>
  )
}

function BossDefeatedOverlay({ world, boss, stats, reward, onContinue, onMap }: {
  world: number
  boss: number
  stats: { score: number; gems: number; kills: number }
  reward: { world?: number; blaster?: string } | null
  onContinue: () => void
  onMap: () => void
}) {
  const b = WORLDS[world].bosses[boss]
  const blaster = reward?.blaster ? BLASTERS.find((x) => x.id === reward.blaster) : null
  return (
    <div className="screen overlay-screen center-modal">
      <div className="panel narrow">
        <h2 className="ok">☠ {b.name} DESTROYED</h2>
        <div className="stat-rows">
          <div><span>Total Score</span><b>{stats.score.toLocaleString()}</b></div>
          <div><span>Gems</span><b>{stats.gems}</b></div>
          <div><span>Aliens blasted</span><b>{stats.kills}</b></div>
        </div>
        {reward && (
          <div className="reward-box">
            <div className="reward-title">✦ REWARDS UNLOCKED ✦</div>
            {reward.world !== undefined && <div>🌌 New Sector: <b>{WORLDS[reward.world].name}</b></div>}
            {blaster && <div>🔫 New Blaster: <b>{blaster.name}</b></div>}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onMap}>SECTOR MAP</button>
          <button className="btn btn-primary" onClick={onContinue}>NEXT TARGET ▶</button>
        </div>
      </div>
    </div>
  )
}

function VictoryScreen({ stats, onLeaderboard }: {
  stats: { score: number; timeMs: number }
  onLeaderboard: () => void
}) {
  return (
    <div className="screen overlay-screen center-modal">
      <div className="panel narrow victory">
        <h1 className="game-title">GALAXY SAVED</h1>
        <p className="tagline">You crushed all 10 sectors. A legend is born.</p>
        <div className="stat-rows">
          <div><span>Final Score</span><b>{stats.score.toLocaleString()}</b></div>
          <div><span>Time</span><b>{(stats.timeMs / 1000 / 60).toFixed(1)} min</b></div>
        </div>
        <button className="btn btn-primary" onClick={onLeaderboard}>RECORD YOUR NAME ▶</button>
      </div>
    </div>
  )
}

function GameOverScreen({ stats, bestScore, onDone }: {
  stats: { score: number; gems: number; kills: number; bossesDefeated: number; worldsCleared: number; timeMs: number }
  bestScore: number
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const isBest = stats.score >= bestScore && stats.score > 0

  const submit = async () => {
    setSubmitting(true)
    const row: ScoreRow = {
      name: name.trim() || 'ANONYMOUS PILOT',
      score: stats.score,
      worlds: stats.worldsCleared,
      bosses: stats.bossesDefeated,
    }
    await submitScore(row)
    setSubmitting(false)
    setDone(true)
    onDone()
  }

  return (
    <div className="screen overlay-screen center-modal">
      <div className="panel narrow">
        <h2 className="danger">GAME OVER</h2>
        {isBest && <p className="new-best">★ NEW PERSONAL BEST ★</p>}
        <div className="stat-rows">
          <div><span>Final Score</span><b>{stats.score.toLocaleString()}</b></div>
          <div><span>Gems collected</span><b>{stats.gems}</b></div>
          <div><span>Aliens blasted</span><b>{stats.kills}</b></div>
          <div><span>Bosses defeated</span><b>{stats.bossesDefeated}</b></div>
          <div><span>Time survived</span><b>{(stats.timeMs / 1000).toFixed(0)}s</b></div>
        </div>
        <label className="name-label">ENTER YOUR PILOT NAME</label>
        <input
          className="name-input"
          maxLength={24}
          value={name}
          placeholder="ANONYMOUS PILOT"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !submitting && !done) submit() }}
          autoFocus
        />
        <button className="btn btn-primary" disabled={submitting || done} onClick={submit}>
          {submitting ? 'SUBMITTING…' : 'SUBMIT TO LEADERBOARD ▶'}
        </button>
      </div>
    </div>
  )
}

function LeaderboardScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<ScoreRow[] | null>(null)
  const [source, setSource] = useState<'supabase' | 'local'>('local')

  useEffect(() => {
    let alive = true
    fetchTop(15).then((res) => {
      if (!alive) return
      setRows(res.rows)
      setSource(res.source)
    })
    return () => { alive = false }
  }, [])

  const medals = useMemo(() => ['🥇', '🥈', '🥉'], [])

  return (
    <div className="screen overlay-screen center-modal">
      <div className="panel narrow">
        <div className="panel-head">
          <h2>🏆 LEADERBOARD</h2>
          <button className="btn small ghost" onClick={onBack}>← BACK</button>
        </div>
        {rows === null && <p className="hint">Loading…</p>}
        {rows !== null && rows.length === 0 && <p className="hint">No scores yet. Be the first!</p>}
        {rows !== null && rows.length > 0 && (
          <ol className="leaderboard">
            {rows.map((r, i) => (
              <li key={i} className={i < 3 ? 'top' : ''}>
                <span className="rank">{medals[i] || i + 1}</span>
                <span className="lb-name">{r.name}</span>
                <span className="lb-meta">{r.bosses}☠ · {r.worlds}🌌</span>
                <span className="lb-score">{r.score.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="source-note">{source === 'supabase' ? '☁ Global (Supabase)' : '💾 Local scores'}</p>
      </div>
    </div>
  )
}
