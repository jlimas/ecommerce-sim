import { ImageOff } from 'lucide-react'
import { useState } from 'react'

import { resolveImageUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Square product image with a fade-in on load and a quiet placeholder if it fails. */
export function ProductImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  return (
    <div className={cn('relative aspect-square overflow-hidden bg-muted', className)}>
      {state === 'error' ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground" role="img" aria-label={alt}>
          <ImageOff className="size-8" aria-hidden />
        </div>
      ) : (
        <img
          src={resolveImageUrl(src)}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
          className={cn(
            'size-full object-contain p-4 mix-blend-multiply transition-all duration-700 ease-out',
            state === 'loaded' ? 'scale-100 opacity-100 blur-0' : 'scale-95 opacity-0 blur-sm',
          )}
        />
      )}
    </div>
  )
}
