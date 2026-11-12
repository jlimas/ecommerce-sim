import { Check, Package, Store, Truck, Zap } from 'lucide-react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { useEffect, useId, useState, type ReactNode } from 'react'

import { AnimatedNumber } from '@/components/motion/animated-number'
import { EASE_OUT, Reveal } from '@/components/motion/reveal'
import { staggerItem } from '@/components/motion/stagger'
import { PageHeader } from '@/components/shared/page-header'
import { Container } from '@/components/shared/section'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCart } from '@/features/cart/cart-context'
import { formatMXN } from '@/lib/format'
import { cn } from '@/lib/utils'

/* ---------------------------------------------------------------------------
 * Policy page scaffold. Exported so the returns page shares the exact same
 * layout, scroll-spy and step cards instead of a near copy.
 * ------------------------------------------------------------------------- */

export const POLICY_UPDATED_AT = '1 de noviembre de 2026'

export interface PolicySectionMeta {
  id: string
  title: string
}

/** Highlights the section whose heading crosses the upper third of the viewport. */
function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? '')
  const key = ids.join('|')

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting)
        const first = ids.find((id) => visible.get(id))
        if (first) setActive(first)
      },
      { rootMargin: '-25% 0px -65% 0px' },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return active
}

export function PolicyLayout({ sections, children }: { sections: PolicySectionMeta[]; children: ReactNode }) {
  const active = useScrollSpy(sections.map((s) => s.id))
  const navId = useId()

  function jump(id: string) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <div className="grid gap-10 pb-24 lg:grid-cols-[220px_1fr] lg:gap-16">
      <nav
        aria-label="En esta página"
        className="sticky top-16 z-10 -mx-4 border-b bg-background/85 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-24 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
      >
        <p className="mb-3 hidden font-pixel text-[10px] tracking-widest text-muted-foreground uppercase lg:block">
          En esta página
        </p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {sections.map((section) => {
            const isActive = section.id === active
            return (
              <li key={section.id} className="relative shrink-0">
                {isActive && (
                  <motion.span
                    layoutId={`policy-nav-${navId}`}
                    className="absolute inset-0 rounded-lg bg-brand/10 lg:border-l-2 lg:border-brand lg:rounded-l-none"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
                <a
                  href={`#${section.id}`}
                  aria-current={isActive ? 'location' : undefined}
                  onClick={(event) => {
                    event.preventDefault()
                    jump(section.id)
                  }}
                  className={cn(
                    'relative block rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                    isActive ? 'text-brand' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {section.title}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="min-w-0 space-y-20">
        {children}
        <p className="border-t pt-6 text-xs text-muted-foreground">Última actualización: {POLICY_UPDATED_AT}</p>
      </div>
    </div>
  )
}

export function PolicySection({ meta, children }: { meta: PolicySectionMeta; children: ReactNode }) {
  return (
    <section id={meta.id} aria-labelledby={`${meta.id}-title`} className="scroll-mt-32 lg:scroll-mt-24">
      <Reveal>
        <h2 id={`${meta.id}-title`} className="mb-6 text-2xl font-semibold tracking-tight md:text-3xl">
          {meta.title}
        </h2>
        <div className="space-y-4 leading-relaxed text-pretty text-muted-foreground [&_strong]:text-foreground">
          {children}
        </div>
      </Reveal>
    </section>
  )
}

export interface PolicyStep {
  title: string
  body: string
}

const stepsList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

/** Numbered cards for a real sequence, connected by a line that draws in. */
export function PolicySteps({ steps }: { steps: PolicyStep[] }) {
  return (
    <div className="relative">
      <motion.span
        aria-hidden
        className="absolute top-9 right-8 left-8 hidden h-px origin-left bg-gradient-to-r from-brand via-lavender to-glitch xl:block"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.2 }}
      />
      <motion.ol
        variants={stepsList}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-40px' }}
        className="relative grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {steps.map((step, index) => (
          <motion.li
            key={step.title}
            variants={staggerItem}
            className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-5"
          >
            <span className="grid size-9 place-items-center rounded-lg border border-brand/40 bg-background font-pixel text-xs text-brand">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="font-medium text-foreground">{step.title}</span>
            <span className="text-sm text-muted-foreground">{step.body}</span>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  )
}

export function PolicyFaq({ items }: { items: [question: string, answer: string][] }) {
  return (
    <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5">
      {items.map(([question, answer]) => (
        <AccordionItem key={question} value={question}>
          <AccordionTrigger className="text-left text-base text-foreground hover:no-underline">{question}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

/* ---------------------------------------------------------------------------
 * Shipping content
 * ------------------------------------------------------------------------- */

const FREE_SHIPPING_FROM = 999
const STANDARD_COST = 149

const SECTIONS = {
  methods: { id: 'metodos', title: 'Métodos y costos' },
  times: { id: 'tiempos', title: 'Tiempos de entrega' },
  tracking: { id: 'seguimiento', title: 'Seguimiento' },
  preorders: { id: 'preventas', title: 'Preventas' },
  faq: { id: 'preguntas', title: 'Preguntas frecuentes' },
} satisfies Record<string, PolicySectionMeta>

const METHODS = [
  { icon: Truck, name: 'Estándar', cost: `${formatMXN(STANDARD_COST)}`, note: 'Gratis desde $999', time: '2 a 4 días hábiles', coverage: 'Todo México' },
  { icon: Zap, name: 'Express', cost: formatMXN(249), time: 'Día hábil siguiente', coverage: 'CDMX, Guadalajara, Monterrey y Puebla' },
  { icon: Package, name: 'Mismo día', cost: formatMXN(349), time: 'Hoy, si compras antes de las 13:00', coverage: 'CDMX y zona metropolitana' },
  { icon: Store, name: 'Recoge en tienda', cost: 'Gratis', time: 'Listo en 2 horas', coverage: 'Nuestras 6 tiendas' },
]

const DELIVERY_STEPS: PolicyStep[] = [
  { title: 'Confirmamos', body: 'Validamos tu pago en minutos y te enviamos el folio.' },
  { title: 'Empacamos', body: 'Caja doble y sello Arkanoid. Las consolas viajan aseguradas.' },
  { title: 'En camino', body: 'Recibes la guía por correo y WhatsApp.' },
  { title: 'Entregado', body: 'Pedimos firma en pedidos mayores a $5,000 MXN.' },
]

const FAQ: [string, string][] = [
  ['¿Envían a apartados postales?', 'No. Necesitamos una dirección con alguien que pueda recibir el paquete.'],
  ['¿Puedo cambiar la dirección después de pagar?', 'Sí, mientras el pedido no haya salido del almacén. Escríbenos con tu folio.'],
  [
    '¿Qué pasa si la caja llega dañada?',
    'Toma una foto antes de abrirla y repórtalo en las primeras 48 horas. Te enviamos un reemplazo sin costo.',
  ],
  ['¿Hacen envíos internacionales?', 'Por ahora solo enviamos dentro de México.'],
  [
    '¿Puedo combinar recoger en tienda y envío a domicilio?',
    'Cada pedido usa un solo método. Si necesitas ambos, haz dos pedidos y el envío gratis se calcula por separado.',
  ],
]

function FreeShippingCalculator() {
  const { subtotal } = useCart()
  // null = the visitor has not typed yet, so we follow the live cart subtotal.
  const [typed, setTyped] = useState<string | null>(null)
  const inputId = useId()

  const fallback = subtotal > 0 ? Math.round(subtotal) : 850
  const raw = typed ?? String(fallback)
  const parsed = Number(raw)
  const amount = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
  const missing = Math.max(0, FREE_SHIPPING_FROM - amount)
  const reached = missing === 0
  const progress = Math.min(100, (amount / FREE_SHIPPING_FROM) * 100)

  return (
    <div className="mt-6 rounded-2xl border border-brand/30 bg-card p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor={inputId} className="text-foreground">
            ¿Cuánto llevas en el carrito?
          </Label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              id={inputId}
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              value={raw}
              onChange={(event) => setTyped(event.target.value)}
              className="h-10 pl-7 tabular-nums"
            />
          </div>
        </div>
        <output htmlFor={inputId} aria-live="polite" className="min-h-10 flex-1 text-sm sm:text-right">
          <AnimatePresence mode="wait" initial={false}>
            {reached ? (
              <motion.span
                key="free"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="inline-flex items-center gap-1.5 font-medium text-brand"
              >
                <Check className="size-4" aria-hidden /> Tu envío estándar es gratis
              </motion.span>
            ) : (
              <motion.span key="missing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                Te faltan{' '}
                <strong className="text-foreground tabular-nums">
                  <AnimatedNumber value={missing} format={formatMXN} />
                </strong>{' '}
                para envío gratis
              </motion.span>
            )}
          </AnimatePresence>
        </output>
      </div>
      <Progress
        value={progress}
        aria-label="Avance hacia el envío gratis"
        className="mt-5 h-2 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-brand [&>[data-slot=progress-indicator]]:to-lavender"
      />
      <p className="mt-2 flex justify-between font-pixel text-[10px] text-muted-foreground">
        <span>$0</span>
        <span>{formatMXN(FREE_SHIPPING_FROM)}</span>
      </p>
    </div>
  )
}

export function ShippingPage() {
  return (
    <Container>
      <PageHeader
        eyebrow="Política de envíos"
        title="Del almacén a tu sala"
        description="Enviamos a todo México desde nuestro centro de distribución en Tlalnepantla."
      />
      <PolicyLayout sections={Object.values(SECTIONS)}>
        <PolicySection meta={SECTIONS.methods}>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Método</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead className="pr-5">Cobertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {METHODS.map(({ icon: Icon, name, cost, note, time, coverage }) => (
                  <TableRow key={name} className="group">
                    <TableCell className="pl-5 font-medium text-foreground">
                      <span className="flex items-center gap-2">
                        <Icon className="size-4 text-brand transition-transform group-hover:scale-110" aria-hidden />
                        {name}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {cost}
                      {note && (
                        <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">{note}</span>
                      )}
                    </TableCell>
                    <TableCell>{time}</TableCell>
                    <TableCell className="pr-5 whitespace-normal">{coverage}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <FreeShippingCalculator />
        </PolicySection>

        <PolicySection meta={SECTIONS.times}>
          <PolicySteps steps={DELIVERY_STEPS} />
          <p>
            Los días hábiles son de lunes a viernes, sin contar días festivos oficiales. Los pedidos confirmados después
            de las 15:00 salen al día hábil siguiente. Zonas extendidas (por ejemplo, Baja California Sur y Quintana Roo
            fuera de Cancún) pueden sumar de 1 a 3 días.
          </p>
        </PolicySection>

        <PolicySection meta={SECTIONS.tracking}>
          <p>
            Con tu folio <span className="font-pixel text-xs text-foreground">TICKET-…</span> y tu correo puedes rastrear
            el pedido desde el mensaje de confirmación. Si la guía no se mueve en 48 horas hábiles, escríbenos a{' '}
            <a href="mailto:envios@arkanoid.mx" className="text-brand underline-offset-4 hover:underline">
              envios@arkanoid.mx
            </a>{' '}
            y lo resolvemos con la paquetería.
          </p>
        </PolicySection>

        <PolicySection meta={SECTIONS.preorders}>
          <p>
            Las preventas se cobran al confirmar el pedido y se envían para llegar el día de lanzamiento en CDMX,
            Guadalajara y Monterrey. Si el precio baja antes del lanzamiento, <strong>te devolvemos la diferencia
            automáticamente</strong>.
          </p>
        </PolicySection>

        <PolicySection meta={SECTIONS.faq}>
          <PolicyFaq items={FAQ} />
        </PolicySection>
      </PolicyLayout>
    </Container>
  )
}
