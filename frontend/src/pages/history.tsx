import { animate, motion, useInView, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { EASE_OUT, Reveal } from '@/components/motion/reveal'
import { Container } from '@/components/shared/section'

const HIGH_SCORE = 1_987_040
const scoreFormat = new Intl.NumberFormat('en-US')

/** Counts up to the record once, the first time it is seen. */
function HighScore() {
  const ref = useRef<HTMLParagraphElement>(null)
  const inView = useInView(ref, { once: true })
  const reduceMotion = useReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView || reduceMotion) return
    const controls = animate(0, HIGH_SCORE, {
      duration: 2.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setValue(Math.round(latest)),
    })
    return () => controls.stop()
  }, [inView, reduceMotion])

  return (
    <p
      ref={ref}
      className="font-pixel text-5xl tracking-tight text-brand tabular-nums [text-shadow:0_0_24px_color-mix(in_oklch,var(--brand)_45%,transparent)] sm:text-7xl md:text-8xl"
      aria-label={`Récord: ${scoreFormat.format(HIGH_SCORE)} puntos`}
    >
      {scoreFormat.format(reduceMotion ? HIGH_SCORE : value)}
    </p>
  )
}

const TIMELINE: [year: string, title: string, body: string][] = [
  [
    '1986',
    'Un local de maquinitas en la Roma',
    'Lupita Garza Orozco, técnica en electrónica egresada del Politécnico, reparaba gabinetes arcade para los locales de la colonia. Le pagaban con fichas y con máquinas que nadie quería.',
  ],
  [
    '1987',
    'Arkanoid abre sus puertas',
    'Con tres gabinetes rescatados y un mostrador de cartuchos de importación, abrió un local de 20 m² en Álvaro Obregón. La noche de la inauguración hizo 1,987,040 puntos. El récord sigue ahí.',
  ],
  [
    '1994',
    'La era de los cartuchos',
    'Arkanoid se volvió el lugar para conseguir juegos antes que nadie. Los sábados se formaban filas para probar la consola nueva conectada a una televisión de 29 pulgadas.',
  ],
  [
    '2003',
    'Segunda tienda y el taller',
    'Abrimos en Coyoacán con un taller de reparación. Lupita entrenó a una generación de técnicos que hoy atienden las garantías de todas las tiendas.',
  ],
  [
    '2011',
    'Guadalajara y Monterrey',
    'Llegamos a Av. Chapultepec y a San Pedro. Cada tienda nueva recibe uno de los gabinetes originales, restaurado en el taller de Coyoacán.',
  ],
  [
    '2018',
    'Puebla, Mérida y la tienda en línea',
    'Abrimos en Angelópolis y en una casona de Paseo de Montejo, y empezamos a enviar a todo México.',
  ],
  [
    '2025',
    'La fila más larga',
    'Para el lanzamiento de Switch 2, la fila en la Roma dio vuelta a la cuadra. Lupita, ya retirada, repartió café y se negó a jugar en la máquina del récord.',
  ],
]

function Timeline() {
  const ref = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })

  return (
    <ol ref={ref} className="relative mx-auto max-w-2xl space-y-14 pl-10 md:pl-0">
      {/* Track plus the scroll-linked fill. */}
      <span aria-hidden className="absolute top-2 bottom-2 left-3 w-px bg-border md:left-1/2" />
      <motion.span
        aria-hidden
        style={{ scaleY: progress }}
        className="absolute top-2 bottom-2 left-3 w-px origin-top bg-gradient-to-b from-brand via-lavender to-glitch md:left-1/2"
      />
      {TIMELINE.map(([year, title, body], index) => {
        const right = index % 2 === 1
        return (
          <motion.li
            key={year}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-15% 0px' }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
            className={`relative md:w-1/2 ${right ? 'md:ml-auto md:pl-12' : 'md:pr-12 md:text-right'}`}
          >
            <motion.span
              aria-hidden
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true, margin: '-15% 0px' }}
              transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.15 }}
              className={`absolute top-1.5 -left-[34px] size-3 rotate-45 border border-brand bg-background ${right ? 'md:-left-1.5' : 'md:-right-1.5 md:left-auto'}`}
            />
            <p className="font-pixel text-xs tracking-widest text-lavender">{year}</p>
            <h3 className="mt-2 text-lg font-medium">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">{body}</p>
          </motion.li>
        )
      })}
    </ol>
  )
}

function Mascot() {
  return (
    <div className="mx-auto grid max-w-3xl items-center gap-10 md:grid-cols-[auto_1fr]">
      <Reveal className="mx-auto">
        <div className="relative grid size-44 place-items-center rounded-3xl border bg-card pixel-grid">
          <motion.img
            src="/arkanoid-avatar.png"
            alt="Ficha, la mascota de Arkanoid: un personaje pixelado con sudadera y gorra azul marino con un invasor espacial"
            className="size-32 object-contain [image-rendering:pixelated]"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="font-pixel text-[11px] tracking-[0.2em] text-muted-foreground uppercase">La mascota</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Ficha</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            La primera noche, mientras esperaba que el último cliente soltara la máquina del fondo, Lupita dibujó un
            personajito en la portada del talonario de notas: sudadera, gorra con un marciano y cara de no haber dormido.
            Lo llamó Ficha, porque así le pagaban sus primeros trabajos.
          </p>
          <p>
            El talonario sigue enmarcado junto a la caja de la Roma. Ficha pasó de la pluma azul a los píxeles, y hoy
            firma cada folio que imprimimos.
          </p>
        </div>
      </Reveal>
    </div>
  )
}

export function HistoryPage() {
  return (
    <Container className="pb-28">
      <header className="mx-auto max-w-3xl py-20 text-center md:py-28">
        <Reveal y={8}>
          <p className="font-pixel text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Nuestra historia</p>
        </Reveal>
        <Reveal delay={0.08} className="mt-8">
          <p className="mb-3 font-pixel text-[11px] text-glitch">HI-SCORE</p>
          <HighScore />
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mx-auto mt-8 max-w-[60ch] text-pretty text-muted-foreground">
            El puntaje que sigue en la máquina del fondo de nuestra tienda de la Roma. Nadie lo ha superado desde el 4 de
            abril de 1987, el día que abrimos.
          </p>
        </Reveal>
      </header>

      <Timeline />

      <div className="my-28 h-px bg-border" />
      <Mascot />

      <Reveal className="mx-auto mt-28 max-w-2xl text-center">
        <blockquote>
          <p className="text-2xl leading-snug font-medium tracking-tight text-balance md:text-3xl">
            “Una tienda de videojuegos no vende cajas. Vende la tarde en la que alguien por fin pasa el nivel.”
          </p>
          <footer className="mt-6 text-sm text-muted-foreground">Lupita Garza Orozco, fundadora</footer>
        </blockquote>
      </Reveal>
    </Container>
  )
}
