import { Badge } from '@/components/ui/badge'
import { formatMXN } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PriceTagProps {
  price: number
  listPrice?: number
  discountPercent?: number
  size?: 'sm' | 'lg'
  className?: string
}

/** Current price, with the struck-through list price and discount badge only when there is a discount. */
export function PriceTag({ price, listPrice, discountPercent = 0, size = 'sm', className }: PriceTagProps) {
  const hasDiscount = discountPercent > 0 && listPrice !== undefined && listPrice > price
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('font-semibold tabular-nums tracking-tight', size === 'lg' ? 'text-3xl' : 'text-base')}>
        {formatMXN(price)}
      </span>
      {hasDiscount && (
        <>
          <span className="text-sm text-muted-foreground line-through tabular-nums" aria-label="Precio de lista">
            {formatMXN(listPrice)}
          </span>
          <Badge className="bg-glitch text-glitch-foreground font-pixel">-{discountPercent}%</Badge>
        </>
      )}
    </div>
  )
}
