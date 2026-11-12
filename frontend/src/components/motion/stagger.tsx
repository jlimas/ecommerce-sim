import { motion, type HTMLMotionProps, type Variants } from 'motion/react'

import { EASE_OUT } from '@/components/motion/reveal'

const container: Variants = {
  hidden: {},
  show: (stagger: number) => ({ transition: { staggerChildren: stagger } }),
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE_OUT } },
}

/** Parent that staggers the entrance of its <StaggerItem> children when it enters the viewport. */
export function Stagger({ stagger = 0.06, children, ...props }: HTMLMotionProps<'div'> & { stagger?: number }) {
  return (
    <motion.div
      variants={container}
      custom={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-40px' }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={staggerItem} {...props}>
      {children}
    </motion.div>
  )
}
