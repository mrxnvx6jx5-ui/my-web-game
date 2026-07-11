import { useEffect, useRef } from 'react'
import { GameEngine, W, H } from '../game/engine'
import type { HudState, StageResult } from '../game/types'

interface Props {
  onEngineReady: (engine: GameEngine) => void
  onHud: (hud: HudState) => void
  onResult: (result: StageResult) => void
}

/**
 * Mounts the canvas and owns a single GameEngine instance for the lifetime of a
 * run. Stays mounted while menus/overlays render on top so the engine (and its
 * score/lives) persists across stages.
 */
export default function GameCanvas({ onEngineReady, onHud, onResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readyRef = useRef(onEngineReady)
  const hudRef = useRef(onHud)
  const resultRef = useRef(onResult)
  readyRef.current = onEngineReady
  hudRef.current = onHud
  resultRef.current = onResult

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new GameEngine(canvas, {
      onHud: (h) => hudRef.current(h),
      onResult: (r) => resultRef.current(r),
    })
    engine.start()
    readyRef.current(engine)
    if (import.meta.env.DEV) (window as unknown as { __engine?: GameEngine }).__engine = engine
    return () => engine.destroy()
  }, [])

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} width={W} height={H} className="game-canvas" />
    </div>
  )
}
