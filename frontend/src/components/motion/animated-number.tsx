import { animate, useMotionValue, useReducedMotion, useTransform, motion } from 'motion/react'
import { useEffect } from 'react'

/** Tweens between numeric values, e.g. cart totals. `format` renders each frame. */
export function AnimatedNumber({ value, format = String }: { value: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion()
  const motionValue = useMotionValue(value)
  const text = useTransform(motionValue, (latest) => format(latest))

  useEffect(() => {
    if (reduce) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [motionValue, reduce, value])

  return <motion.span>{text}</motion.span>
}
