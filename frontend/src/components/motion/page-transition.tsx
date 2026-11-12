import { motion } from 'motion/react'
import type { ReactNode } from 'react'

import { EASE_OUT } from '@/components/motion/reveal'

/** Wraps a routed page so route changes cross-fade and slide. Used by RootLayout. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  )
}
