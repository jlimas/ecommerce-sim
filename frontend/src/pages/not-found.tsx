import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { Container } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/site'

const COUNTDOWN_FROM = 9

export function NotFoundPage() {
  const { pathname } = useLocation()
  const [seconds, setSeconds] = useState(COUNTDOWN_FROM)

  useEffect(() => {
    if (seconds <= 0) return
    const id = window.setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [seconds])

  return (
    <Container className="relative flex min-h-[70svh] flex-col items-center justify-center py-20 text-center">
      <div aria-hidden className="absolute inset-0 -z-10 pixel-grid [mask-image:radial-gradient(circle,black,transparent_70%)]" />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-pixel text-[11px] tracking-[0.25em] text-muted-foreground uppercase"
      >
        Error 404
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, scale: 1.3, filter: 'blur(12px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 font-pixel text-6xl text-glitch glitch-once glitch-hover sm:text-8xl"
      >
        GAME OVER
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-6 max-w-md text-pretty text-muted-foreground"
      >
        No encontramos <span className="font-medium break-all text-foreground">{pathname}</span>. Puede que el enlace
        haya cambiado o que este nivel nunca existiera.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-10 flex flex-col items-center gap-6"
      >
        <p className="font-pixel text-sm text-brand" aria-live="off">
          {seconds > 0 ? (
            <>
              ¿CONTINUAR?{' '}
              <motion.span
                key={seconds}
                initial={{ opacity: 0, scale: 1.6 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-block w-4"
              >
                {seconds}
              </motion.span>
            </>
          ) : (
            <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
              INSERT COIN
            </motion.span>
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="h-11 rounded-full px-6">
            <Link to={ROUTES.home}>Continuar</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6">
            <Link to={ROUTES.catalog}>Ir al catálogo</Link>
          </Button>
        </div>
      </motion.div>
    </Container>
  )
}
