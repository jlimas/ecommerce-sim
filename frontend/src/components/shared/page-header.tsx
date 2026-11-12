import type { ReactNode } from 'react'

import { Reveal } from '@/components/motion/reveal'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: ReactNode
  children?: ReactNode
}

/** Consistent animated heading block at the top of every subpage. */
export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <header className="mx-auto max-w-3xl py-16 text-center md:py-24">
      {eyebrow && (
        <Reveal y={8}>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.3em] text-brand">{eyebrow}</p>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance md:text-6xl">{title}</h1>
      </Reveal>
      {description && (
        <Reveal delay={0.12}>
          <p className="mt-5 text-lg text-pretty text-muted-foreground">{description}</p>
        </Reveal>
      )}
      {children && <Reveal delay={0.18}>{children}</Reveal>}
    </header>
  )
}
