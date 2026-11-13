import { Heart, Pause, Play, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

/* ---------------------------------------------------------------------------
 * Playable breakout, shown in a dialog from the home hero.
 * The engine runs imperatively inside one effect (refs, no per-frame React renders);
 * React only renders the HUD and overlays when a discrete game event happens.
 * ------------------------------------------------------------------------- */

const W = 480 // logical canvas size; scaled to the element with devicePixelRatio
const H = 600
const PADDLE_W = 84
const PADDLE_H = 10
const PADDLE_Y = H - 44
const BALL_R = 6
const COLS = 10
const GAP = 4
const PAD_X = 16
const TOP = 76
const BRICK_H = 16
const BRICK_W = (W - PAD_X * 2 - GAP * (COLS - 1)) / COLS
const START_LIVES = 3
const MAX_BOUNCE_ANGLE = Math.PI / 3 // 60° from vertical at the paddle edges
const KEYBOARD_SPEED = 9
const RECORD = 1_987_040
const BEST_KEY = 'arkanoid.breakout.best'

export type GameStatus = 'ready' | 'playing' | 'paused' | 'cleared' | 'over'

interface Brick {
  x: number
  y: number
  row: number
  hits: number
  maxHits: number
  alive: boolean
  fade: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

interface Hud {
  status: GameStatus
  score: number
  lives: number
  level: number
  best: number
}

function readBest(): number {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function writeBest(value: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(value))
  } catch {
    // Private mode or blocked storage: the best score just isn't remembered.
  }
}

function cssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'white'
}

/** Brick layout per level: full wall, pyramid, checkerboard, then deterministic pseudo-random walls. */
function buildLevel(level: number): Brick[] {
  const rows = Math.min(5 + level - 1, 8)
  const bricks: Brick[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      const keep =
        level === 1 ||
        (level === 2 && col >= row / 2 && col < COLS - row / 2) ||
        (level === 3 && (row + col) % 2 === 0) ||
        (level > 3 && Math.sin(level * 97 + row * 13 + col * 7) > -0.55)
      if (!keep) continue
      // Upper rows get tougher as levels go up.
      const maxHits = (level >= 2 && row === 0) || (level >= 4 && row === 1) ? 2 : 1
      bricks.push({ x: PAD_X + col * (BRICK_W + GAP), y: TOP + row * (BRICK_H + GAP), row, hits: 0, maxHits, alive: true, fade: 1 })
    }
  }
  return bricks
}

function ballSpeed(level: number): number {
  return Math.min(5 + (level - 1) * 0.6, 9)
}

export function BreakoutGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduceMotion = useReducedMotion()
  const [hud, setHud] = useState<Hud>({ status: 'ready', score: 0, lives: START_LIVES, level: 1, best: readBest() })
  // Commands from React buttons into the engine (set once the engine starts).
  const commands = useRef<{ togglePause: () => void; restart: () => void; launch: () => void } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const palette = {
      rows: ['--glitch', '--lavender', '--royal', '--brand', '--brand', '--lavender', '--royal', '--glitch'].map(cssToken),
      paddle: cssToken('--foreground'),
      ball: cssToken('--brand'),
      tough: cssToken('--foreground'),
    }

    let status: GameStatus = 'ready'
    let score = 0
    let lives = START_LIVES
    let level = 1
    let best = readBest()
    let bricks = buildLevel(level)
    let particles: Particle[] = []
    let shake = 0
    let paddleX = W / 2
    let targetX: number | null = null
    const keys = { left: false, right: false }
    const ball = { x: W / 2, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 }
    let raf = 0
    let lastTime = 0
    let clearedAt = 0

    const emit = () => setHud({ status, score, lives, level, best })

    function setStatus(next: GameStatus) {
      status = next
      emit()
    }

    function resetBallOnPaddle() {
      ball.vx = 0
      ball.vy = 0
      ball.x = paddleX
      ball.y = PADDLE_Y - BALL_R - 1
    }

    function launch() {
      if (status !== 'ready') return
      const speed = ballSpeed(level)
      const angle = (Math.random() - 0.5) * (Math.PI / 4)
      ball.vx = speed * Math.sin(angle)
      ball.vy = -speed * Math.cos(angle)
      setStatus('playing')
    }

    function togglePause() {
      if (status === 'playing') setStatus('paused')
      else if (status === 'paused') {
        lastTime = performance.now()
        setStatus('playing')
      }
    }

    function restart() {
      score = 0
      lives = START_LIVES
      level = 1
      bricks = buildLevel(level)
      particles = []
      resetBallOnPaddle()
      setStatus('ready')
    }

    commands.current = { togglePause, restart, launch }

    function addScore(points: number) {
      score += points
      if (score > best) {
        best = score
        writeBest(best)
      }
      emit()
    }

    function burst(x: number, y: number, color: string) {
      if (reduceMotion) return
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1 + Math.random() * 3
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color })
      }
    }

    function hitBrick(): boolean {
      for (const brick of bricks) {
        if (!brick.alive) continue
        // Circle vs rectangle: closest point on the brick to the ball centre.
        const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + BRICK_W))
        const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + BRICK_H))
        const dx = ball.x - closestX
        const dy = ball.y - closestY
        if (dx * dx + dy * dy > BALL_R * BALL_R) continue

        // Bounce on the axis with the smaller penetration, then push the ball out of the brick.
        const overlapX = BALL_R - Math.abs(dx) + (dx === 0 ? BRICK_W / 2 : 0)
        const overlapY = BALL_R - Math.abs(dy) + (dy === 0 ? BRICK_H / 2 : 0)
        if (overlapX < overlapY) {
          ball.vx = dx >= 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx)
          ball.x += Math.sign(dx || ball.vx) * overlapX
        } else {
          ball.vy = dy >= 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy)
          ball.y += Math.sign(dy || ball.vy) * overlapY
        }

        brick.hits += 1
        const color = palette.rows[brick.row % palette.rows.length]
        if (brick.hits >= brick.maxHits) {
          brick.alive = false
          burst(brick.x + BRICK_W / 2, brick.y + BRICK_H / 2, color)
          shake = reduceMotion ? 0 : 3
          addScore(10 * (8 - brick.row) * brick.maxHits * level)
        } else {
          addScore(5 * level)
        }
        return true
      }
      return false
    }

    function update(dt: number) {
      // Paddle: pointer target wins, otherwise keyboard.
      if (targetX !== null) paddleX += (targetX - paddleX) * Math.min(1, 0.45 * dt)
      else paddleX += ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * KEYBOARD_SPEED * dt
      paddleX = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, paddleX))

      if (status === 'ready') {
        ball.x = paddleX
        return
      }
      if (status === 'cleared') {
        if (performance.now() - clearedAt > 1400) {
          level += 1
          bricks = buildLevel(level)
          resetBallOnPaddle()
          setStatus('ready')
        }
        return
      }
      if (status !== 'playing') return

      // Sub-steps keep fast balls from tunnelling through bricks.
      const steps = Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / (BALL_R * 0.75))
      for (let i = 0; i < steps; i++) {
        ball.x += (ball.vx * dt) / steps
        ball.y += (ball.vy * dt) / steps

        if (ball.x < BALL_R) {
          ball.x = BALL_R
          ball.vx = Math.abs(ball.vx)
        } else if (ball.x > W - BALL_R) {
          ball.x = W - BALL_R
          ball.vx = -Math.abs(ball.vx)
        }
        if (ball.y < BALL_R) {
          ball.y = BALL_R
          ball.vy = Math.abs(ball.vy)
        }

        const onPaddle =
          ball.vy > 0 &&
          ball.y + BALL_R >= PADDLE_Y &&
          ball.y - BALL_R <= PADDLE_Y + PADDLE_H &&
          Math.abs(ball.x - paddleX) <= PADDLE_W / 2 + BALL_R
        if (onPaddle) {
          const offset = Math.max(-1, Math.min(1, (ball.x - paddleX) / (PADDLE_W / 2)))
          const speed = ballSpeed(level)
          ball.vx = speed * Math.sin(offset * MAX_BOUNCE_ANGLE)
          ball.vy = -speed * Math.cos(offset * MAX_BOUNCE_ANGLE)
          ball.y = PADDLE_Y - BALL_R
        }

        if (hitBrick() && bricks.every((brick) => !brick.alive)) {
          clearedAt = performance.now()
          addScore(500 * level)
          setStatus('cleared')
          return
        }

        if (ball.y - BALL_R > H) {
          lives -= 1
          shake = reduceMotion ? 0 : 6
          if (lives <= 0) {
            setStatus('over')
          } else {
            resetBallOnPaddle()
            setStatus('ready')
          }
          return
        }
      }
    }

    function draw() {
      if (!ctx) return
      ctx.save()
      ctx.clearRect(0, 0, W, H)
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)
        shake *= 0.85
        if (shake < 0.3) shake = 0
      }

      for (const brick of bricks) {
        if (!brick.alive) {
          if (brick.fade <= 0) continue
          brick.fade -= 0.08
        }
        const color = palette.rows[brick.row % palette.rows.length]
        ctx.globalAlpha = Math.max(0, brick.fade) * (brick.maxHits > 1 && brick.hits > 0 ? 0.55 : 1)
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.roundRect(brick.x, brick.y + (brick.alive ? 0 : (1 - brick.fade) * 12), BRICK_W, BRICK_H, 3)
        ctx.fill()
        if (brick.alive && brick.maxHits > 1) {
          // Tough bricks show a light inner bar until their first hit.
          ctx.shadowBlur = 0
          ctx.globalAlpha = brick.hits === 0 ? 0.85 : 0.3
          ctx.fillStyle = palette.tough
          ctx.fillRect(brick.x + 6, brick.y + BRICK_H / 2 - 1, BRICK_W - 12, 2)
        }
      }
      ctx.globalAlpha = 1

      particles = particles.filter((p) => p.life > 0)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.08
        p.life -= 0.03
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
      }
      ctx.globalAlpha = 1

      ctx.shadowColor = palette.ball
      ctx.shadowBlur = 14
      ctx.fillStyle = palette.paddle
      ctx.beginPath()
      ctx.roundRect(paddleX - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 5)
      ctx.fill()

      ctx.fillStyle = palette.ball
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    function frame(now: number) {
      // dt is measured in 60 fps frames and clamped so a background tab doesn't teleport the ball.
      const dt = lastTime ? Math.min(3, (now - lastTime) / (1000 / 60)) : 1
      lastTime = now
      update(dt)
      draw()
      raf = requestAnimationFrame(frame)
    }

    function resize() {
      if (!canvas || !ctx) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const scale = canvas.clientWidth / W
      canvas.width = Math.round(W * scale * dpr)
      canvas.height = Math.round(H * scale * dpr)
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0)
    }

    const toLogicalX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect()
      return ((clientX - rect.left) / rect.width) * W
    }
    const onPointerMove = (event: PointerEvent) => {
      targetX = toLogicalX(event.clientX)
    }
    const onPointerDown = (event: PointerEvent) => {
      targetX = toLogicalX(event.clientX)
      if (status === 'ready') launch()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        keys.left = true
        targetX = null
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        keys.right = true
        targetX = null
      } else if (event.key === ' ') {
        // A focused button handles its own Space press (e.g. "Pausa"), so don't double-toggle.
        if (event.target instanceof HTMLElement && event.target.closest('button, a, input')) return
        event.preventDefault()
        if (status === 'ready') launch()
        else if (status === 'over') restart()
        else togglePause()
      } else if (event.key === 'p' || event.key === 'P') {
        togglePause()
      } else {
        return
      }
      event.preventDefault()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') keys.left = false
      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') keys.right = false
    }
    const onVisibility = () => {
      if (document.hidden && status === 'playing') setStatus('paused')
    }

    resize()
    resetBallOnPaddle()
    emit()
    canvas.focus({ preventScroll: true })
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('visibilitychange', onVisibility)
      commands.current = null
    }
  }, [reduceMotion])

  const restart = useCallback(() => commands.current?.restart(), [])
  const togglePause = useCallback(() => commands.current?.togglePause(), [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 font-pixel text-[11px] tracking-wider tabular-nums">
        <span className="text-brand">
          PUNTOS <AnimatedScore value={hud.score} />
        </span>
        <span className="text-lavender">NIVEL {hud.level}</span>
        <span className="flex items-center gap-1" aria-label={`${hud.lives} vidas`}>
          {Array.from({ length: START_LIVES }, (_, index) => (
            <Heart
              key={index}
              aria-hidden
              className={index < hud.lives ? 'size-3.5 fill-glitch text-glitch' : 'size-3.5 text-muted-foreground/40'}
            />
          ))}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-background pixel-grid">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          className="block aspect-[4/5] w-full cursor-none touch-none outline-none"
          role="img"
          aria-label="Juego de romper bloques. Mueve la paleta con el cursor, el dedo o las flechas; espacio para lanzar y pausar."
        />
        <AnimatePresence>
          {hud.status !== 'playing' && (
            <motion.div
              key={hud.status === 'cleared' ? `cleared-${hud.level}` : hud.status}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute inset-0 grid place-items-center"
            >
              <Overlay hud={hud} onRestart={restart} onResume={togglePause} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Mejor: <span className="font-mono text-foreground">{hud.best.toLocaleString('es-MX')}</span> · Récord de la tienda:{' '}
          <span className="font-mono text-glitch">{RECORD.toLocaleString('en-US')}</span>
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={togglePause} disabled={hud.status !== 'playing' && hud.status !== 'paused'}>
            {hud.status === 'paused' ? <Play /> : <Pause />}
            {hud.status === 'paused' ? 'Seguir' : 'Pausa'}
          </Button>
          <Button variant="ghost" size="sm" onClick={restart}>
            <RotateCcw /> Reiniciar
          </Button>
        </div>
      </div>
    </div>
  )
}

function Overlay({ hud, onRestart, onResume }: { hud: Hud; onRestart: () => void; onResume: () => void }) {
  if (hud.status === 'ready') {
    return (
      <div className="text-center">
        <p className="font-pixel text-lg text-brand">{hud.level === 1 && hud.score === 0 ? 'LISTO' : `NIVEL ${hud.level}`}</p>
        <p className="mt-2 text-sm text-muted-foreground">Haz clic, toca o presiona espacio para lanzar</p>
      </div>
    )
  }
  if (hud.status === 'paused') {
    return (
      <div className="pointer-events-auto text-center">
        <p className="font-pixel text-lg text-lavender">PAUSA</p>
        <Button className="mt-4" onClick={onResume}>
          <Play /> Seguir jugando
        </Button>
      </div>
    )
  }
  if (hud.status === 'cleared') {
    return (
      <p className="font-pixel text-xl text-brand glitch-once">
        ¡NIVEL {hud.level} SUPERADO!
      </p>
    )
  }
  const newBest = hud.score > 0 && hud.score >= hud.best
  return (
    <div className="pointer-events-auto rounded-2xl bg-background/80 px-8 py-6 text-center backdrop-blur-sm">
      <p className="font-pixel text-2xl text-glitch glitch-once">GAME OVER</p>
      <p className="mt-3 font-mono text-3xl tabular-nums">{hud.score.toLocaleString('es-MX')}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {newBest ? '¡Nuevo récord personal!' : `Te faltan ${(RECORD - hud.score).toLocaleString('es-MX')} para el récord de Lupita`}
      </p>
      <Button className="mt-5" onClick={onRestart}>
        <RotateCcw /> Jugar de nuevo
      </Button>
    </div>
  )
}

/** Score with a small pop whenever it changes. */
function AnimatedScore({ value }: { value: number }) {
  return (
    <motion.span key={value} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="inline-block">
      {String(value).padStart(6, '0')}
    </motion.span>
  )
}
