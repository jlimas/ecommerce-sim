import { AlertCircle, ArrowRight, Check, Loader2, Lock, ShieldAlert, ShoppingBag } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'

import { AnimatedNumber, EASE_OUT, Stagger, StaggerItem } from '@/components/motion'
import { Container, EmptyState, PageHeader, ProductImage } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart, type CartLine } from '@/features/cart/cart-context'
import { formatMXN, formatPieces } from '@/lib/format'
import { ROUTES } from '@/lib/site'
import type { PaymentReceipt } from '@/lib/types'
import { cn } from '@/lib/utils'

const FREE_SHIPPING_FROM = 999
const STANDARD_SHIPPING = 149
const MIN_CARD_DIGITS = 4
const MAX_CARD_DIGITS = 19
const PIN_LENGTH = 4

const shippingFor = (subtotal: number) => (subtotal >= FREE_SHIPPING_FROM ? 0 : STANDARD_SHIPPING)
const onlyDigits = (value: string) => value.replace(/\D/g, '')
const groupDigits = (digits: string) => digits.replace(/(.{4})(?=.)/g, '$1 ')

interface FieldErrors {
  card?: string
  pin?: string
}

/** Mirrors the mock gateway rules: card has at least 4 digits, PIN equals its last 4 digits. */
function validate(cardDigits: string, pin: string): FieldErrors {
  const errors: FieldErrors = {}
  if (cardDigits.length < MIN_CARD_DIGITS) errors.card = 'Escribe al menos 4 dígitos de la tarjeta ficticia.'
  if (!/^\d{4}$/.test(pin)) errors.pin = 'El PIN de prueba tiene 4 dígitos.'
  else if (!errors.card && pin !== cardDigits.slice(-PIN_LENGTH))
    errors.pin = 'El PIN debe coincidir con los últimos 4 dígitos de la tarjeta.'
  return errors
}

export function CheckoutPage() {
  const { lines, subtotal, status, checkout, refresh } = useCart()
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // The cart empties the moment the payment succeeds; keep showing the order while the receipt renders.
  const [snapshot, setSnapshot] = useState<{ lines: CartLine[]; subtotal: number } | null>(null)

  if (receipt) return <Receipt receipt={receipt} />

  const summaryLines = snapshot?.lines ?? lines
  const summarySubtotal = snapshot?.subtotal ?? subtotal

  if (summaryLines.length === 0) {
    if (status === 'loading') return <CheckoutSkeleton />
    return (
      <Container className="pb-24">
        <PageHeader eyebrow="Pago" title="Tu carrito está vacío" description="Agrega productos antes de pagar." />
        <EmptyState
          icon={ShoppingBag}
          title="Nada que cobrar todavía"
          description="Explora el catálogo y vuelve cuando tengas tu próxima partida lista."
          action={
            <Button asChild className="mt-2">
              <Link to={ROUTES.catalog}>
                Ir al catálogo <ArrowRight />
              </Link>
            </Button>
          }
        />
      </Container>
    )
  }

  async function pay(creditCardNumber: string, pin: string) {
    setSnapshot({ lines, subtotal })
    setSubmitting(true)
    try {
      const result = await checkout({ creditCardNumber, pin })
      setReceipt(result)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      // A stale or already-paid cart: resync so the page reflects the server.
      setSnapshot(null)
      void refresh()
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  const shipping = shippingFor(summarySubtotal)
  const total = summarySubtotal + shipping
  const allLoaded = summaryLines.every((line) => line.product !== undefined)

  return (
    <Container className="pb-24">
      <PageHeader eyebrow="Pago seguro" title="Último nivel: pagar" />
      <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: EASE_OUT }}
        >
          <PaymentForm total={total} disabled={!allLoaded} submitting={submitting} onPay={pay} />
        </motion.div>
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2, ease: EASE_OUT }}
          className="rounded-3xl border bg-card p-6 lg:sticky lg:top-24"
          aria-label="Resumen del pedido"
        >
          <h2 className="font-heading text-lg font-semibold">Resumen</h2>
          <ul className="mt-4 space-y-4">
            <AnimatePresence initial={false}>
              {summaryLines.map((line) => (
                <motion.li
                  key={line.item.productId}
                  layout
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="flex items-center gap-3"
                >
                  {line.product ? (
                    <>
                      <div className="relative size-14 shrink-0 rounded-xl border bg-background">
                        <ProductImage
                          src={line.product.imageUrl}
                          alt=""
                          className="size-14 rounded-xl bg-transparent [&_img]:p-1.5"
                        />
                        <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-brand font-pixel text-[0.6rem] text-brand-foreground">
                          {line.item.quantity}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm leading-snug">{line.product.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPieces(line.item.quantity)}</p>
                      </div>
                      <span className="text-sm tabular-nums">{formatMXN(line.lineTotal)}</span>
                    </>
                  ) : (
                    <>
                      <Skeleton className="size-14 rounded-xl" />
                      <Skeleton className="h-4 flex-1" />
                    </>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <Separator className="my-5" />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">
                <AnimatedNumber value={summarySubtotal} format={formatMXN} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Envío estándar</dt>
              <dd className={cn('tabular-nums', shipping === 0 && 'text-brand')}>
                {shipping === 0 ? 'Gratis' : formatMXN(shipping)}
              </dd>
            </div>
            {shipping > 0 && (
              <p className="text-xs text-muted-foreground">
                Agrega {formatMXN(FREE_SHIPPING_FROM - summarySubtotal)} más y el envío es gratis.
              </p>
            )}
            <Separator className="my-3" />
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">
                <AnimatedNumber value={total} format={formatMXN} />
              </dd>
            </div>
          </dl>
        </motion.aside>
      </div>
    </Container>
  )
}

interface PaymentFormProps {
  total: number
  disabled: boolean
  submitting: boolean
  onPay: (creditCardNumber: string, pin: string) => Promise<void>
}

function PaymentForm({ total, disabled, submitting, onPay }: PaymentFormProps) {
  const cardId = useId()
  const pinId = useId()
  const [cardDigits, setCardDigits] = useState('')
  const [pin, setPin] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [pinFocused, setPinFocused] = useState(false)
  const [apiError, setApiError] = useState<string>()

  // Errors appear after the first submit attempt, then update live as the user fixes them.
  const errors = attempted ? validate(cardDigits, pin) : {}

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    setApiError(undefined)
    const found = validate(cardDigits, pin)
    if (found.card || found.pin) return
    try {
      await onPay(cardDigits, pin)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'No pudimos procesar el pago. Inténtalo de nuevo.')
    }
  }

  const previewDigits = cardDigits.padEnd(Math.max(16, cardDigits.length), '•')

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-3xl border bg-card p-6">
      <h2 className="font-heading text-lg font-semibold">Tarjeta</h2>

      <div className="mt-4 flex gap-3 rounded-2xl border border-glitch/40 bg-glitch/10 p-4 text-sm">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-glitch" aria-hidden />
        <p>
          <b>Pasarela de prueba.</b> Nunca uses una tarjeta real. Usa una ficticia como{' '}
          <span className="font-mono">1111 2222 3333 4444</span> y como PIN sus últimos 4 dígitos.
        </p>
      </div>

      {/* Live card preview: flips to show the PIN while that field has focus. */}
      <div className="my-6 [perspective:1200px]">
        <motion.div
          animate={{ rotateY: pinFocused ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative mx-auto aspect-[1.586] w-full max-w-sm"
        >
          <div
            style={{ backfaceVisibility: 'hidden' }}
            className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-royal to-glitch p-6 text-foreground neon-glow"
          >
            <div aria-hidden className="pixel-grid absolute inset-0 opacity-60" />
            <div aria-hidden className="absolute -top-16 -right-10 size-48 rounded-full bg-brand/30 blur-3xl" />
            <div className="relative flex items-start justify-between">
              <span className="font-pixel text-[0.65rem] tracking-widest opacity-80">ARKANOID PLAYER CARD</span>
              <span className="font-pixel text-xs text-brand">1987</span>
            </div>
            <div aria-hidden className="relative h-8 w-11 rounded-md bg-gradient-to-br from-lavender to-brand/70 opacity-90" />
            <p className="relative font-mono text-lg tracking-[0.18em] tabular-nums sm:text-xl" aria-hidden>
              {groupDigits(previewDigits)}
            </p>
          </div>
          <div
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className="absolute inset-0 flex flex-col justify-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-bl from-navy via-royal to-navy text-foreground neon-glow"
          >
            <div aria-hidden className="h-10 w-full bg-background/80" />
            <div className="flex items-center justify-end gap-3 px-6">
              <span className="font-pixel text-[0.6rem] opacity-70">PIN</span>
              <span className="rounded-md bg-foreground/90 px-3 py-1 font-mono tracking-[0.3em] text-background" aria-hidden>
                {pin.padEnd(PIN_LENGTH, '•').replace(/\d/g, '●')}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="space-y-5">
        <Field id={cardId} label="Número de tarjeta" error={errors.card}>
          <Input
            id={cardId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="1111 2222 3333 4444"
            value={groupDigits(cardDigits)}
            onChange={(event) => setCardDigits(onlyDigits(event.target.value).slice(0, MAX_CARD_DIGITS))}
            aria-invalid={Boolean(errors.card)}
            aria-describedby={errors.card ? `${cardId}-error` : undefined}
            className="h-11 font-mono tracking-wider"
            disabled={submitting}
          />
        </Field>
        <Field id={pinId} label="PIN de prueba" hint="Los últimos 4 dígitos de la tarjeta." error={errors.pin}>
          <Input
            id={pinId}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="••••"
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={(event) => setPin(onlyDigits(event.target.value).slice(0, PIN_LENGTH))}
            onFocus={() => setPinFocused(true)}
            onBlur={() => setPinFocused(false)}
            aria-invalid={Boolean(errors.pin)}
            aria-describedby={errors.pin ? `${pinId}-error` : `${pinId}-hint`}
            className="h-11 w-32 font-mono tracking-[0.4em]"
            disabled={submitting}
          />
        </Field>
      </div>

      <AnimatePresence>
        {apiError && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{apiError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        type="submit"
        size="lg"
        disabled={disabled || submitting}
        className="mt-6 h-12 w-full rounded-full text-base neon-glow"
      >
        {submitting ? (
          <>
            <Loader2 className="animate-spin" /> Procesando pago…
          </>
        ) : (
          <>
            <Lock /> Pagar <AnimatedNumber value={total} format={formatMXN} />
          </>
        )}
      </Button>
    </form>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <AnimatePresence mode="wait" initial={false}>
        {error ? (
          <motion.p
            key={error}
            id={`${id}-error`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: [-6, 4, -2, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-destructive"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            id={`${id}-hint`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-muted-foreground"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function Receipt({ receipt }: { receipt: PaymentReceipt }) {
  const productsTotal = receipt.paymentSummary.totalAmount
  const shipping = shippingFor(productsTotal)

  return (
    <Container className="pb-24">
      <div className="mx-auto max-w-xl py-16 text-center md:py-24">
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
          className="mx-auto grid size-20 place-items-center rounded-full bg-brand text-brand-foreground neon-glow"
        >
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 400, damping: 18 }}
          >
            <Check className="size-9" strokeWidth={3} aria-hidden />
          </motion.span>
        </motion.div>

        <Stagger stagger={0.08} className="mt-8">
          <StaggerItem>
            <p className="font-pixel text-xs tracking-widest text-brand uppercase">Pago aprobado</p>
          </StaggerItem>
          <StaggerItem>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight glitch-once md:text-5xl">
              ¡Nivel superado!
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-3 text-muted-foreground">{receipt.message} Te enviamos el comprobante por correo.</p>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-6 inline-block max-w-full rounded-xl border border-dashed px-4 py-2 font-mono text-sm break-all">
              {receipt.ticketId}
            </p>
          </StaggerItem>

          <StaggerItem>
            <div className="mt-8 rounded-3xl border bg-card p-6 text-left">
              <ul className="space-y-3 text-sm">
                {receipt.purchasedItems.map((item) => (
                  <li key={item.productId} className="flex justify-between gap-4">
                    <span className="min-w-0">
                      {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatMXN(item.totalPrice)}</span>
                  </li>
                ))}
              </ul>
              <Separator className="my-4" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Productos</dt>
                  <dd className="tabular-nums">{formatMXN(productsTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Envío estándar</dt>
                  <dd className="tabular-nums">{shipping === 0 ? 'Gratis' : formatMXN(shipping)}</dd>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">
                    <AnimatedNumber value={productsTotal + shipping} format={formatMXN} />
                  </dd>
                </div>
                <div className="flex justify-between pt-2">
                  <dt className="text-muted-foreground">Tarjeta</dt>
                  <dd className="font-mono">{receipt.paymentSummary.paymentMethod.card}</dd>
                </div>
              </dl>
            </div>
          </StaggerItem>

          <StaggerItem>
            <Button asChild size="lg" className="mt-8 rounded-full">
              <Link to={ROUTES.catalog}>
                Seguir comprando <ArrowRight />
              </Link>
            </Button>
          </StaggerItem>
        </Stagger>
      </div>
    </Container>
  )
}

function CheckoutSkeleton() {
  return (
    <Container className="pb-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 py-16 md:py-24">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-72" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Skeleton className="h-[560px] rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    </Container>
  )
}
