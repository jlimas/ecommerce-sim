import { motion, type HTMLMotionProps } from 'motion/react'

import { cn } from '@/lib/utils'

export const EASE_OUT = [0.22, 1, 0.36, 1] as const

interface RevealProps extends HTMLMotionProps<'div'> {
  /** Seconds to wait before animating. */
  delay?: number
  /** Initial vertical offset in px. */
  y?: number
}

/** Fades and lifts its children in the first time they scroll into view. */
export function Reveal({ delay = 0, y = 24, className, children, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: EASE_OUT }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}
