import { AnimatePresence, MotionConfig } from 'motion/react'
import { useEffect } from 'react'
import { useLocation, useOutlet } from 'react-router'

import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { PageTransition } from '@/components/motion/page-transition'
import { Toaster } from '@/components/ui/sonner'
import { CartSheet } from '@/features/cart/cart-sheet'

export function RootLayout() {
  const location = useLocation()
  const outlet = useOutlet()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    // Respects the OS "reduce motion" setting for every motion component.
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-svh flex-col">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50">
          Saltar al contenido
        </a>
        <SiteHeader />
        <main id="contenido" className="flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>{outlet}</PageTransition>
          </AnimatePresence>
        </main>
        <SiteFooter />
        <CartSheet />
        <Toaster position="bottom-right" />
      </div>
    </MotionConfig>
  )
}
