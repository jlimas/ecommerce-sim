import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { AnimatedNumber, EASE_OUT } from '@/components/motion'
import { ProductImage } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart, type CartLine } from '@/features/cart/cart-context'
import { formatMXN, formatPieces } from '@/lib/format'
import { ROUTES } from '@/lib/site'
import { cn } from '@/lib/utils'

const FREE_SHIPPING_FROM = 999
const STANDARD_SHIPPING = 149
const MAX_QUANTITY = 99

/** Right-side cart drawer, opened from the header cart button or "Ver carrito" toasts. */
export function CartSheet() {
  const { lines, totalPieces, subtotal, status, error, isOpen, setOpen, refresh } = useCart()
  const navigate = useNavigate()

  const allLoaded = lines.every((line) => line.product !== undefined)
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : STANDARD_SHIPPING
  const total = subtotal + shipping
  const missing = Math.max(0, FREE_SHIPPING_FROM - subtotal)
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_FROM) * 100)
  const isEmpty = lines.length === 0

  function goToCheckout() {
    setOpen(false)
    navigate(ROUTES.checkout)
  }

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="size-5 text-brand" aria-hidden />
            Tu carrito
          </SheetTitle>
          <SheetDescription>
            {isEmpty ? 'Sin productos todavía.' : `${formatPieces(totalPieces)} listas para jugar.`}
          </SheetDescription>
        </SheetHeader>

        {/* Free shipping meter */}
        <AnimatePresence initial={false}>
          {!isEmpty && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="overflow-hidden border-b"
            >
              <div className="space-y-2.5 px-6 py-4 text-sm">
                <p className="flex items-center gap-2">
                  <Truck className={cn('size-4', missing ? 'text-muted-foreground' : 'text-brand')} aria-hidden />
                  {missing ? (
                    <span>
                      Te faltan <b className="tabular-nums">{formatMXN(missing)}</b> para envío gratis
                    </span>
                  ) : (
                    <b className="text-brand">Tu envío es gratis</b>
                  )}
                </p>
                <Progress
                  value={progress}
                  aria-label="Avance hacia el envío gratis"
                  className="h-1.5 [&>[data-slot=progress-indicator]]:bg-brand [&>[data-slot=progress-indicator]]:duration-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto px-6">
          {status === 'loading' && isEmpty ? (
            <div className="space-y-4 py-5" aria-busy="true">
              <LineSkeleton />
              <LineSkeleton />
            </div>
          ) : status === 'error' && isEmpty ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-sm">
              <p className="text-muted-foreground">{error ?? 'No pudimos cargar tu carrito.'}</p>
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                Reintentar
              </Button>
            </div>
          ) : isEmpty ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="flex flex-col items-center gap-3 py-20 text-center"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="grid size-16 place-items-center rounded-full bg-muted"
              >
                <ShoppingBag className="size-7 text-brand" aria-hidden />
              </motion.div>
              <h3 className="font-medium">Tu carrito está vacío</h3>
              <p className="max-w-60 text-sm text-muted-foreground">Agrega un juego, una consola o ese control que te falta.</p>
              <Button asChild className="mt-2" onClick={() => setOpen(false)}>
                <Link to={ROUTES.catalog}>
                  Explorar catálogo <ArrowRight />
                </Link>
              </Button>
            </motion.div>
          ) : (
            <ul className="relative divide-y">
              <AnimatePresence mode="popLayout" initial={false}>
                {lines.map((line) => (
                  <motion.li
                    key={line.item.productId}
                    layout
                    initial={{ opacity: 0, x: 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 48, transition: { duration: 0.22 } }}
                    transition={{ duration: 0.35, ease: EASE_OUT, layout: { type: 'spring', stiffness: 400, damping: 36 } }}
                    className="bg-popover py-4"
                  >
                    {line.product ? <CartLineRow line={line} /> : <LineSkeleton />}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* Totals */}
        {!isEmpty && (
          <SheetFooter className="gap-3 border-t px-6 py-5">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">
                  <AnimatedNumber value={subtotal} format={formatMXN} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Envío estándar</dt>
                <dd className={cn('tabular-nums', shipping === 0 && 'text-brand')}>
                  {shipping === 0 ? 'Gratis' : formatMXN(shipping)}
                </dd>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  <AnimatedNumber value={total} format={formatMXN} />
                </dd>
              </div>
            </dl>
            <Button size="lg" className="h-11 rounded-full neon-glow" onClick={goToCheckout} disabled={!allLoaded}>
              Pagar <ArrowRight />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-muted-foreground">
              Seguir comprando
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

function CartLineRow({ line }: { line: CartLine }) {
  const { setQuantity, remove, pendingIds, setOpen } = useCart()
  const product = line.product!
  const { quantity } = line.item
  const pending = pendingIds.has(product.id)

  async function run(action: () => Promise<void>, failure: string) {
    try {
      await action()
    } catch (error) {
      toast.error(failure, { description: error instanceof Error ? error.message : undefined })
    }
  }

  return (
    <div className={cn('flex gap-4 transition-opacity', pending && 'opacity-60')}>
      <Link
        to={ROUTES.product(product.id)}
        onClick={() => setOpen(false)}
        className="block size-20 shrink-0 overflow-hidden rounded-xl border bg-card"
      >
        <ProductImage src={product.imageUrl} alt={product.name} className="size-20 bg-transparent [&_img]:p-2" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-pixel text-[0.6rem] tracking-widest text-muted-foreground uppercase">
              {product.attributes.platform}
            </p>
            <Link
              to={ROUTES.product(product.id)}
              onClick={() => setOpen(false)}
              className="line-clamp-2 text-sm leading-snug font-medium hover:underline"
            >
              {product.name}
            </Link>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Quitar ${product.name} del carrito`}
            disabled={pending}
            onClick={() => void run(() => remove(product.id), 'No se pudo quitar')}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex h-8 items-center rounded-full border" role="group" aria-label="Cantidad">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Quitar una pieza"
              disabled={pending}
              onClick={() => void run(() => setQuantity(product.id, quantity - 1), 'No se pudo actualizar')}
            >
              <Minus />
            </Button>
            <span className="relative w-7 overflow-hidden text-center text-xs font-medium tabular-nums">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={quantity}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="inline-block"
                >
                  {quantity}
                </motion.span>
              </AnimatePresence>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Agregar una pieza"
              disabled={pending || quantity >= MAX_QUANTITY}
              onClick={() => void run(() => setQuantity(product.id, quantity + 1), 'No se pudo actualizar')}
            >
              <Plus />
            </Button>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums">
              <AnimatedNumber value={line.lineTotal} format={formatMXN} />
            </p>
            {quantity > 1 && (
              <p className="text-xs text-muted-foreground tabular-nums">{formatMXN(product.price)} c/u</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LineSkeleton() {
  return (
    <div className="flex gap-4">
      <Skeleton className="size-20 shrink-0 rounded-xl" />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-4 w-4/5" />
        <div className="mt-auto flex justify-between">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}
