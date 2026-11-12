import { Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { PriceTag } from '@/components/shared/price-tag'
import { ProductImage } from '@/components/shared/product-image'
import { Button } from '@/components/ui/button'
import { useCart } from '@/features/cart/cart-context'
import type { Product } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Catalog tile: image zoom on hover, quick add-to-cart, links to the product page. */
export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { add, pendingIds, setOpen } = useCart()
  const pending = pendingIds.has(product.id)

  async function handleAdd() {
    try {
      await add(product)
      toast.success('Agregado al carrito', {
        description: product.name,
        action: { label: 'Ver carrito', onClick: () => setOpen(true) },
      })
    } catch (error) {
      toast.error('No se pudo agregar', { description: error instanceof Error ? error.message : undefined })
    }
  }

  return (
    <motion.article
      layout
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={cn('group relative flex flex-col overflow-hidden rounded-2xl border bg-card', className)}
    >
      <Link to={`/catalogo/${product.id}`} className="block focus-visible:outline-none" aria-label={product.name}>
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="[&_img]:group-hover:scale-105 [&_img]:transition-transform"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{product.attributes.platform}</p>
        <Link to={`/catalogo/${product.id}`} className="line-clamp-2 font-medium leading-snug hover:underline">
          {product.name}
        </Link>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <PriceTag price={product.price} listPrice={product.listPrice} discountPercent={product.discountPercent} />
          <Button
            size="icon"
            variant="secondary"
            aria-label={`Agregar ${product.name} al carrito`}
            disabled={pending}
            onClick={handleAdd}
            className="shrink-0 rounded-full transition-transform active:scale-90"
          >
            <Plus className={cn('transition-transform duration-300', pending && 'animate-spin')} />
          </Button>
        </div>
      </div>
    </motion.article>
  )
}
