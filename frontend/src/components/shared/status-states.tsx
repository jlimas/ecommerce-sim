import { AlertTriangle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Reveal className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      {Icon && (
        <div className="grid size-14 place-items-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" aria-hidden />
        </div>
      )}
      <h2 className="text-lg font-medium">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action}
    </Reveal>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Algo salió mal"
      description={message}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        )
      }
    />
  )
}
