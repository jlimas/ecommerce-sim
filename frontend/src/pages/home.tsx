import { ArrowRight, Disc3, Gamepad2, Headphones, Trophy, Tv } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'

import { EASE_OUT, Reveal } from '@/components/motion/reveal'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { ProductCard } from '@/components/shared/product-card'
import { Container } from '@/components/shared/section'
import { ErrorState } from '@/components/shared/status-states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/use-async'
import { api } from '@/lib/api'
import { ROUTES } from '@/lib/site'
import type { CategoryName } from '@/lib/types'
import { STORES, StoreStatusBadge, getStoreStatus, useNow } from '@/pages/locations'

/* ---------------------------------------------------------------------------
 * Breakout hero canvas
 * ------------------------------------------------------------------------- */

const HIGH_SCORE = 1_987_040

interface Brick {
  x: number
  y: number
  w: number
  h: number
  row: number
  alive: boolean
  alpha: number
}

/** Reads a theme token from :root so the canvas follows the CSS palette. */
function cssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'white'
}

function BreakoutArena() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scoreRef = useRef<HTMLSpanElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const palette = {
      rows: [cssToken('--glitch'), cssToken('--lavender'), cssToken('--royal'), cssToken('--brand'), cssToken('--brand')],
      paddle: cssToken('--foreground'),
      ball: cssToken('--brand'),
    }

    let width = 0
    let height = 0
    let bricks: Brick[] = []
    let paddle = { w: 80, x: 0, y: 0 }
    let ball = { x: 0, y: 0, vx: 3.1, vy: -3.6, r: 6 }
    let score = 0
    let pointerX: number | null = null
    let raf = 0
    let running = false
    let onScreen = true
    let pageVisible = !document.hidden

    const writeScore = () => {
      if (scoreRef.current) scoreRef.current.textContent = String(score).padStart(6, '0')
    }

    function resize() {
      if (!canvas || !ctx) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function resetBoard() {
      const cols = 9
      const rows = 5
      const gap = 6
      const pad = 20
      const top = 52
      const bw = Math.max(8, (width - pad * 2 - gap * (cols - 1)) / cols)
      bricks = []
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          bricks.push({ x: pad + col * (bw + gap), y: top + row * 18, w: bw, h: 12, row, alive: true, alpha: 1 })
        }
      }
      paddle = { w: Math.max(70, width * 0.18), x: width / 2, y: height - 40 }
      ball = { x: width / 2, y: height - 60, vx: 3.1, vy: -3.6, r: 6 }
    }

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      for (const b of bricks) {
        if (!b.alive && b.alpha <= 0) continue
        if (!b.alive) b.alpha -= 0.06
        ctx.globalAlpha = Math.max(0, b.alpha)
        ctx.fillStyle = palette.rows[b.row % palette.rows.length]
        ctx.shadowColor = palette.rows[b.row % palette.rows.length]
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.roundRect(b.x, b.y + (b.alive ? 0 : (1 - b.alpha) * 10), b.w, b.h, 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      ctx.fillStyle = palette.paddle
      ctx.beginPath()
      ctx.roundRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, 8, 4)
      ctx.fill()
      ctx.fillStyle = palette.ball
      ctx.shadowColor = palette.ball
      ctx.shadowBlur = 16
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    function step() {
      // Without a pointer the paddle follows the ball with a lazy wobble (attract mode).
      const target = pointerX ?? ball.x + Math.sin(performance.now() / 600) * paddle.w * 0.3
      const clamped = Math.max(paddle.w / 2, Math.min(width - paddle.w / 2, target))
      paddle.x += (clamped - paddle.x) * (pointerX === null ? 0.12 : 0.3)
      ball.x += ball.vx
      ball.y += ball.vy

      if (ball.x < ball.r || ball.x > width - ball.r) {
        ball.vx *= -1
        ball.x = Math.max(ball.r, Math.min(width - ball.r, ball.x))
      }
      if (ball.y < ball.r) ball.vy = Math.abs(ball.vy)

      const hitsPaddle =
        ball.vy > 0 &&
        ball.y + ball.r >= paddle.y &&
        ball.y < paddle.y + 8 &&
        Math.abs(ball.x - paddle.x) < paddle.w / 2 + ball.r
      if (hitsPaddle) {
        const offset = (ball.x - paddle.x) / (paddle.w / 2)
        const speed = Math.hypot(ball.vx, ball.vy)
        ball.vx = speed * Math.sin(offset * 1.05)
        ball.vy = -Math.abs(speed * Math.cos(offset * 1.05))
      }
      if (ball.y > height + 20) {
        ball.x = paddle.x
        ball.y = paddle.y - 20
        ball.vy = -Math.abs(ball.vy)
      }

      for (const b of bricks) {
        if (b.alive && ball.x > b.x - ball.r && ball.x < b.x + b.w + ball.r && ball.y > b.y - ball.r && ball.y < b.y + b.h + ball.r) {
          b.alive = false
          ball.vy *= -1
          score += 10 * (5 - b.row)
          writeScore()
          break
        }
      }
      if (bricks.length > 0 && bricks.every((b) => !b.alive && b.alpha <= 0)) resetBoard()
    }

    function loop() {
      step()
      draw()
      raf = requestAnimationFrame(loop)
    }

    function syncRunning() {
      const shouldRun = !reduceMotion && onScreen && pageVisible
      if (shouldRun && !running) {
        running = true
        raf = requestAnimationFrame(loop)
      } else if (!shouldRun && running) {
        running = false
        cancelAnimationFrame(raf)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX - canvas.getBoundingClientRect().left
    }
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (touch) pointerX = touch.clientX - canvas.getBoundingClientRect().left
    }
    const onPointerLeave = () => {
      pointerX = null
    }
    const onVisibility = () => {
      pageVisible = !document.hidden
      syncRunning()
    }

    resize()
    resetBoard()
    writeScore()
    draw()

    const resizeObserver = new ResizeObserver(() => {
      resize()
      resetBoard()
      draw()
    })
    resizeObserver.observe(canvas)

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? false
      syncRunning()
    })
    intersectionObserver.observe(canvas)

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('touchend', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibility)
    syncRunning()

    return () => {
      running = false
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('touchend', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduceMotion])

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-brand/30 bg-card/60 pixel-grid neon-glow">
      <canvas
        ref={canvasRef}
        className="block size-full touch-none"
        role="img"
        aria-label="Animación de bloques rompiéndose, estilo arcade"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-5 pt-4 font-pixel text-[11px] tracking-wider">
        <span className="text-brand">
          1UP <span ref={scoreRef}>000000</span>
        </span>
        <span className="text-glitch">HI {HIGH_SCORE.toLocaleString('en-US')}</span>
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-muted-foreground">
        Mueve el cursor o el dedo para controlar la paleta
      </p>
    </div>
  )
}

/** The store mascot: idle bob plus an occasional cyan/magenta glitch flicker. */
function FloatingMascot() {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) {
    return (
      <img
        src="/arkanoid-avatar.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -left-6 size-28 object-contain [image-rendering:pixelated] sm:-left-10 sm:size-36"
      />
    )
  }
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute -bottom-8 -left-6 size-28 sm:-left-10 sm:size-36"
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.img
        src="/arkanoid-avatar.png"
        alt=""
        className="size-full object-contain [image-rendering:pixelated]"
        animate={{
          x: [0, 0, -3, 3, 0, 0],
          filter: [
            'drop-shadow(0 0 0 transparent)',
            'drop-shadow(0 0 0 transparent)',
            'drop-shadow(-3px 0 0 var(--glitch)) drop-shadow(3px 0 0 var(--brand))',
            'drop-shadow(3px 0 0 var(--glitch)) drop-shadow(-3px 0 0 var(--brand))',
            'drop-shadow(0 0 0 transparent)',
            'drop-shadow(0 0 0 transparent)',
          ],
        }}
        transition={{ duration: 4.5, times: [0, 0.86, 0.89, 0.92, 0.95, 1], repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  )
}

/* ---------------------------------------------------------------------------
 * Page sections
 * ------------------------------------------------------------------------- */

const HEADLINE = ['La', 'tienda', 'que', 'nunca', 'apagó', 'la', 'consola.']

const headlineContainer: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }
const headlineWord: Variants = {
  hidden: { opacity: 0, y: '0.6em', filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE_OUT } },
}

function Hero() {
  return (
    <Container className="grid items-center gap-14 py-14 md:py-20 lg:grid-cols-[1.05fr_1fr]">
      <div>
        <Reveal y={8}>
          <p className="font-pixel text-[11px] tracking-[0.2em] text-brand uppercase">Desde 1987 · Hecho en la Roma, CDMX</p>
        </Reveal>
        <motion.h1
          variants={headlineContainer}
          initial="hidden"
          animate="show"
          className="mt-5 text-5xl leading-[1.02] font-semibold tracking-tight text-balance md:text-7xl"
          aria-label={HEADLINE.join(' ')}
        >
          {HEADLINE.map((word, index) => (
            <motion.span
              key={`${word}-${index}`}
              variants={headlineWord}
              aria-hidden
              className={
                index === HEADLINE.length - 1
                  ? 'inline-block bg-gradient-to-r from-brand via-lavender to-glitch bg-clip-text text-transparent'
                  : 'inline-block'
              }
            >
              {word}
              {index < HEADLINE.length - 1 && ' '}
            </motion.span>
          ))}
        </motion.h1>
        <Reveal delay={0.5}>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            Consolas, videojuegos y accesorios con precios en pesos, envío a todo México y seis tiendas donde todavía
            puedes probar antes de comprar.
          </p>
        </Reveal>
        <Reveal delay={0.62} className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-11 rounded-full px-6 text-sm">
            <Link to={ROUTES.catalog}>
              Ver catálogo
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6 text-sm">
            <Link to={ROUTES.locations}>Encuentra tu tienda</Link>
          </Button>
        </Reveal>
      </div>
      <Reveal delay={0.3} y={32} className="relative">
        <BreakoutArena />
        <FloatingMascot />
      </Reveal>
    </Container>
  )
}

const PERKS = [
  'Envío gratis desde $999 MXN',
  'Recoge en tienda en 2 horas',
  '30 días para devolver',
  'Meses sin intereses en consolas',
  'Preventas con precio garantizado',
  'Prueba antes de comprar en tienda',
]

function PerksMarquee() {
  return (
    <div className="relative overflow-hidden border-y bg-card/40 py-4 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <motion.div
        className="flex w-max gap-12 pr-12"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
      >
        {[...PERKS, ...PERKS].map((perk, index) => (
          <span
            key={index}
            aria-hidden={index >= PERKS.length}
            className="flex items-center gap-3 text-sm whitespace-nowrap text-muted-foreground"
          >
            <span className="size-1.5 rotate-45 bg-brand" aria-hidden />
            {perk}
          </span>
        ))}
      </motion.div>
    </div>
  )
}

const CATEGORIES: { name: CategoryName; copy: string; icon: typeof Gamepad2 }[] = [
  { name: 'Consolas', copy: 'Switch 2, Xbox y más', icon: Gamepad2 },
  { name: 'Videojuegos', copy: 'Lanzamientos y clásicos', icon: Disc3 },
  { name: 'Accesorios', copy: 'Controles, memoria, estuches', icon: Headphones },
  { name: 'Pantallas', copy: '4K para jugar en grande', icon: Tv },
  { name: 'Coleccionables', copy: 'Figuras y ediciones', icon: Trophy },
]

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-pixel text-[11px] tracking-[0.2em] text-brand uppercase">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      </div>
      {action}
    </Reveal>
  )
}

function Categories() {
  return (
    <Container className="py-20">
      <SectionHeading eyebrow="Explora" title="Elige tu nivel" />
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {CATEGORIES.map(({ name, copy, icon: Icon }, index) => (
          <StaggerItem key={name} className={index === CATEGORIES.length - 1 ? 'col-span-2 md:col-span-1' : undefined}>
            <Link
              to={`${ROUTES.catalog}?categoria=${encodeURIComponent(name)}`}
              className="group relative flex h-full min-h-40 flex-col justify-between overflow-hidden rounded-2xl border bg-card p-5 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-brand/50"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-brand/0 via-royal/0 to-glitch/0 opacity-0 transition-opacity duration-500 group-hover:from-brand/10 group-hover:to-glitch/10 group-hover:opacity-100"
              />
              <Icon
                className="relative size-7 text-lavender transition-[color,transform] duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:text-brand"
                aria-hidden
              />
              <span className="relative">
                <span className="block font-medium group-hover:animate-[glitch-shift_0.45s_steps(2,end)_1]">{name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{copy}</span>
              </span>
              <ArrowRight
                className="absolute top-5 right-5 size-4 -translate-x-2 text-brand opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden
              />
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </Container>
  )
}

function WeeklyDeals() {
  const deals = useAsync((signal) => api.listProducts({ sort: 'discountDesc', limit: 8 }, signal), [])

  return (
    <Container className="py-20">
      <SectionHeading
        eyebrow="Ofertas de la semana"
        title="Bonus de precio, por tiempo limitado"
        action={
          <Link
            to={ROUTES.catalog}
            className="group inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            Ver todo <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        }
      />
      {deals.status === 'error' && !deals.data ? (
        <ErrorState message={deals.error.message} onRetry={deals.reload} />
      ) : !deals.data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Cargando ofertas">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border bg-card">
              <Skeleton className="aspect-square rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {deals.data.map((product) => (
            <StaggerItem key={product.id} className="h-full">
              <ProductCard product={product} className="h-full" />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </Container>
  )
}

function VisitStores() {
  const now = useNow()
  return (
    <Container className="py-20">
      <Reveal className="grid overflow-hidden rounded-3xl border bg-card md:grid-cols-[1.1fr_1fr]">
        <div className="relative flex flex-col justify-end gap-4 overflow-hidden bg-navy p-8 md:p-12">
          <div aria-hidden className="absolute inset-0 pixel-grid opacity-60" />
          <div aria-hidden className="absolute top-8 right-8 grid grid-cols-4 gap-1.5">
            {Array.from({ length: 12 }, (_, index) => (
              <motion.span
                key={index}
                className="size-3 rounded-[2px] bg-brand"
                animate={{ opacity: [0.15, 1, 0.15] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: (index * 0.37) % 2.4, ease: 'easeInOut' }}
              />
            ))}
          </div>
          <p className="relative font-pixel text-[11px] tracking-[0.2em] text-lavender uppercase">Seis tiendas</p>
          <h2 className="relative max-w-sm text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Ven a jugar antes de llevártelo.
          </h2>
          <Button asChild variant="secondary" className="relative h-10 self-start rounded-full px-5">
            <Link to={ROUTES.locations}>
              Ver ubicaciones <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <ul className="divide-y">
          {STORES.slice(0, 4).map((store) => (
            <li key={store.id}>
              <Link
                to={ROUTES.locations}
                className="group flex items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-muted/40 md:px-8"
              >
                <span>
                  <span className="block font-medium transition-colors group-hover:text-brand">{store.name}</span>
                  <span className="text-sm text-muted-foreground">{store.city}</span>
                </span>
                <StoreStatusBadge status={getStoreStatus(store, now)} />
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </Container>
  )
}

export function HomePage() {
  return (
    <>
      <Hero />
      <PerksMarquee />
      <Categories />
      <WeeklyDeals />
      <VisitStores />
    </>
  )
}
