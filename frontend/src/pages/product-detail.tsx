import { ArrowLeft, Check, Minus, Plus, RotateCcw, ShoppingBag, Store, Truck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { AnimatedNumber, EASE_OUT, Reveal, Stagger, StaggerItem } from '@/components/motion'
import { Container, EmptyState, ErrorState, PriceTag, ProductCard, ProductImage } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart } from '@/features/cart/cart-context'
import { useAsync } from '@/hooks/use-async'
import { ApiError, api } from '@/lib/api'
import { formatMXN } from '@/lib/format'
import { ROUTES } from '@/lib/site'
import type { Product } from '@/lib/types'
import { cn } from '@/lib/utils'

const FREE_SHIPPING_FROM = 999
const STANDARD_SHIPPING = 149
const MAX_QUANTITY = 99
const ADDED_FEEDBACK_MS = 1600
const RELATED_LIMIT = 4

export function ProductDetailPage() {
  const { productId = '' } = useParams()
  const product = useAsync((signal) => api.getProduct(productId, signal), [productId])

  if (product.status === 'error') {
    if (product.error instanceof ApiError && product.error.status === 404) return <ProductNotFound productId={productId} />
    return (
      <Container className="py-16">
        <ErrorState message={product.error.message} onRetry={product.reload} />
      </Container>
    )
  }

  if (!product.data || product.data.id !== productId) return <ProductDetailSkeleton />
  return <ProductDetail product={product.data} />
}

function ProductDetail({ product }: { product: Product }) {
  const { add, pendingIds, setOpen } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const resetTimer = useRef<number | undefined>(undefined)
  const pending = pendingIds.has(product.id)
  const { platform, category, brand } = product.attributes
  const savings = product.listPrice - product.price
  const freeShipping = product.price >= FREE_SHIPPING_FROM

  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  const related = useAsync(
    async (signal) => {
      const sameFamily = await api.listProducts({ platform, limit: RELATED_LIMIT + 1 }, signal)
      return sameFamily.filter((candidate) => candidate.id !== product.id).slice(0, RELATED_LIMIT)
    },
    [platform, product.id],
  )

  async function handleAdd() {
    try {
      await add(product, quantity)
      setAdded(true)
      toast.success('Agregado al carrito', {
        description: `${product.name} · ${quantity} ${quantity === 1 ? 'pieza' : 'piezas'}`,
        action: { label: 'Ver carrito', onClick: () => setOpen(true) },
      })
      window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => {
        setAdded(false)
        setQuantity(1)
      }, ADDED_FEEDBACK_MS)
    } catch (error) {
      toast.error('No se pudo agregar', { description: error instanceof Error ? error.message : undefined })
    }
  }

  const notes = [
    {
      icon: Truck,
      text: freeShipping
        ? 'Envío gratis · llega en 2 a 4 días hábiles'
        : `Envío estándar ${formatMXN(STANDARD_SHIPPING)} · gratis desde ${formatMXN(FREE_SHIPPING_FROM)}`,
    },
    { icon: Store, text: 'Recógelo en 2 horas en Arkanoid Roma Norte' },
    { icon: RotateCcw, text: '30 días para devolverlo si sigue sellado' },
  ]

  const specs = [
    { label: 'SKU', value: product.id, mono: true },
    { label: 'Marca', value: brand },
    { label: 'Plataforma', value: platform },
    { label: 'Categoría', value: category },
  ]

  return (
    <Container className="pb-24">
      <Reveal y={6} className="pt-8 pb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={ROUTES.home}>Inicio</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={ROUTES.catalog}>Catálogo</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`${ROUTES.catalog}?categoria=${encodeURIComponent(category)}`}>{category}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem className="hidden sm:inline-flex">
              <BreadcrumbPage className="line-clamp-1 max-w-64">{product.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Reveal>

      <div className="grid gap-10 md:grid-cols-2 md:gap-14">
        {/* Gallery */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="relative self-start overflow-hidden rounded-3xl border bg-card pixel-grid md:sticky md:top-24"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 bottom-6 h-10 rounded-full bg-brand/20 blur-2xl"
          />
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="relative"
          >
            <ProductImage src={product.imageUrl} alt={product.name} className="bg-transparent [&_img]:p-10" />
          </motion.div>
          {product.discountPercent > 0 && (
            <Badge className="absolute top-4 left-4 bg-glitch font-pixel text-glitch-foreground">
              -{product.discountPercent}%
            </Badge>
          )}
        </motion.div>

        {/* Info */}
        <Stagger stagger={0.07} className="flex flex-col">
          <StaggerItem>
            <p className="font-pixel text-xs tracking-widest text-brand uppercase">{platform}</p>
          </StaggerItem>
          <StaggerItem>
            <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
              {product.name}
            </h1>
          </StaggerItem>
          <StaggerItem className="mt-5">
            <PriceTag
              price={product.price}
              listPrice={product.listPrice}
              discountPercent={product.discountPercent}
              size="lg"
            />
            {savings > 0 && product.discountPercent > 0 && (
              <p className="mt-1.5 text-sm text-glitch">Ahorras {formatMXN(savings)}</p>
            )}
          </StaggerItem>
          <StaggerItem>
            <p className="mt-5 leading-relaxed text-pretty text-muted-foreground">{product.description}</p>
          </StaggerItem>

          {/* Buy box */}
          <StaggerItem className="mt-7 flex flex-wrap items-center gap-3">
            <div className="flex h-11 items-center rounded-full border bg-card" role="group" aria-label="Cantidad">
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-full"
                aria-label="Quitar una pieza"
                disabled={quantity <= 1 || pending}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus />
              </Button>
              <span className="relative w-8 overflow-hidden text-center font-pixel text-sm tabular-nums" aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={quantity}
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="inline-block"
                  >
                    {quantity}
                  </motion.span>
                </AnimatePresence>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-full"
                aria-label="Agregar una pieza"
                disabled={quantity >= MAX_QUANTITY || pending}
                onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
              >
                <Plus />
              </Button>
            </div>

            <motion.div layout className="flex-1" transition={{ type: 'spring', stiffness: 400, damping: 32 }}>
              <Button
                size="lg"
                onClick={handleAdd}
                disabled={pending || added}
                aria-live="polite"
                className={cn(
                  'h-11 w-full min-w-56 overflow-hidden rounded-full text-sm transition-colors duration-300 disabled:opacity-100',
                  added ? 'bg-glitch text-glitch-foreground hover:bg-glitch' : 'neon-glow',
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {added ? (
                    <motion.span
                      key="added"
                      initial={{ y: 16, opacity: 0, scale: 0.9 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: -16, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="flex items-center gap-2"
                    >
                      <Check className="size-4" /> Agregado
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ y: 16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -16, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2"
                    >
                      <ShoppingBag className={cn('size-4', pending && 'animate-pulse')} />
                      {pending ? 'Agregando…' : 'Agregar al carrito'}
                      <span className="opacity-60">·</span>
                      <span className="tabular-nums">
                        <AnimatedNumber value={product.price * quantity} format={formatMXN} />
                      </span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          </StaggerItem>

          {/* Shipping, pickup, returns */}
          <StaggerItem className="mt-7 divide-y rounded-2xl border bg-card/60">
            {notes.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Icon className="size-4 shrink-0 text-brand" aria-hidden />
                <span>{text}</span>
              </div>
            ))}
          </StaggerItem>

          {/* Specs */}
          <StaggerItem>
            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {specs.map((spec) => (
                <div key={spec.label}>
                  <dt className="font-pixel text-[0.65rem] tracking-widest text-muted-foreground uppercase">{spec.label}</dt>
                  <dd className={cn('mt-1', spec.mono && 'font-mono tabular-nums')}>{spec.value}</dd>
                </div>
              ))}
            </dl>
          </StaggerItem>

          {product.tags.length > 0 && (
            <StaggerItem className="mt-6 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="rounded-full text-muted-foreground">
                  #{tag}
                </Badge>
              ))}
            </StaggerItem>
          )}
        </Stagger>
      </div>

      {/* Related */}
      {related.data && related.data.length > 0 && (
        <section className="mt-24">
          <Separator className="mb-12" />
          <Reveal className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="font-pixel text-xs tracking-widest text-glitch uppercase">Combínalo con</p>
              <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight md:text-3xl">
                También te puede gustar
              </h2>
            </div>
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to={`${ROUTES.catalog}?plataforma=${encodeURIComponent(platform)}`}>Ver más de {platform}</Link>
            </Button>
          </Reveal>
          <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.data.map((item) => (
              <StaggerItem key={item.id} className="h-full">
                <ProductCard product={item} className="h-full" />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </Container>
  )
}

function ProductDetailSkeleton() {
  return (
    <Container className="pb-24">
      <div className="pt-8 pb-6" aria-busy="true">
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-10 md:grid-cols-2 md:gap-14">
        <Skeleton className="aspect-square rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-3 pt-3">
            <Skeleton className="h-11 w-32 rounded-full" />
            <Skeleton className="h-11 flex-1 rounded-full" />
          </div>
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
    </Container>
  )
}

function ProductNotFound({ productId }: { productId: string }) {
  return (
    <Container className="py-16">
      <EmptyState
        icon={ShoppingBag}
        title="Ese producto ya no está en el juego"
        description={
          <>
            No encontramos el SKU <span className="font-mono text-foreground">{productId}</span>. Quizá cambió de
            nivel o nunca existió.
          </>
        }
        action={
          <Button asChild className="mt-2">
            <Link to={ROUTES.catalog}>
              <ArrowLeft /> Volver al catálogo
            </Link>
          </Button>
        }
      />
    </Container>
  )
}
