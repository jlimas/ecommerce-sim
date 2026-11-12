import { ArrowUpRight, Clock, MapPin, Phone } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'

import { EASE_OUT, Reveal } from '@/components/motion/reveal'
import { PageHeader } from '@/components/shared/page-header'
import { Container } from '@/components/shared/section'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

/* ---------------------------------------------------------------------------
 * Store data and live status. Exported because the home page teaser shows the
 * same stores; this file is the single source for them.
 * ------------------------------------------------------------------------- */

export interface Store {
  id: string
  name: string
  city: string
  /** Short key used by the city filter. */
  cityKey: string
  address: string
  /** Opening and closing hour, America/Mexico_City, same every day. */
  opens: number
  closes: number
  phone: string
  features: string[]
}

export const STORES: Store[] = [
  {
    id: 'roma-norte',
    name: 'Arkanoid Roma Norte',
    city: 'Ciudad de México',
    cityKey: 'CDMX',
    address: 'Álvaro Obregón 187, Roma Norte, Cuauhtémoc, 06700',
    opens: 10,
    closes: 21,
    phone: '55 1987 0420',
    features: ['Tienda original', 'Zona arcade', 'Torneos los viernes'],
  },
  {
    id: 'coyoacan',
    name: 'Arkanoid Coyoacán',
    city: 'Ciudad de México',
    cityKey: 'CDMX',
    address: 'Francisco Sosa 36, Santa Catarina, Coyoacán, 04010',
    opens: 11,
    closes: 20,
    phone: '55 1987 0421',
    features: ['Retro y usados', 'Taller de reparación'],
  },
  {
    id: 'chapultepec',
    name: 'Arkanoid Chapultepec',
    city: 'Guadalajara, Jalisco',
    cityKey: 'Guadalajara',
    address: 'Av. Chapultepec Sur 120, Americana, 44160',
    opens: 10,
    closes: 21,
    phone: '33 1987 0422',
    features: ['Demo de Switch 2', 'Recoge en 2 horas'],
  },
  {
    id: 'san-pedro',
    name: 'Arkanoid San Pedro',
    city: 'Monterrey, Nuevo León',
    cityKey: 'Monterrey',
    address: 'Calzada del Valle 400, Del Valle, San Pedro Garza García, 66220',
    opens: 10,
    closes: 22,
    phone: '81 1987 0423',
    features: ['Sala de pantallas 4K', 'Estacionamiento'],
  },
  {
    id: 'angelopolis',
    name: 'Arkanoid Angelópolis',
    city: 'Puebla, Puebla',
    cityKey: 'Puebla',
    address: 'Blvd. del Niño Poblano 2510, Reserva Territorial Atlixcáyotl, 72830',
    opens: 11,
    closes: 21,
    phone: '22 1987 0424',
    features: ['Dentro de plaza', 'Recoge en 2 horas'],
  },
  {
    id: 'montejo',
    name: 'Arkanoid Montejo',
    city: 'Mérida, Yucatán',
    cityKey: 'Mérida',
    address: 'Paseo de Montejo 451, Centro, 97000',
    opens: 10,
    closes: 20,
    phone: '99 1987 0425',
    features: ['Casona de 1910', 'Café y lectura de cómics'],
  },
]

const mexicoCityClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Mexico_City',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Minutes since midnight in Mexico City, independent of the visitor's time zone. */
function mexicoCityMinutes(now: Date): number {
  const parts = mexicoCityClock.formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

export interface StoreStatus {
  open: boolean
  label: string
}

export function getStoreStatus(store: Store, now: Date): StoreStatus {
  const minutes = mexicoCityMinutes(now)
  const open = minutes >= store.opens * 60 && minutes < store.closes * 60
  return open
    ? { open, label: `Abierto · cierra ${hourLabel(store.closes)}` }
    : { open, label: `Cerrado · abre ${hourLabel(store.opens)}` }
}

/** Current time, refreshed every `intervalMs` so open/closed badges stay live. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function StoreStatusBadge({ status, className }: { status: StoreStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        status.open ? 'border-brand/40 bg-brand/10 text-brand' : 'border-border bg-muted text-muted-foreground',
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {status.open && <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-70" />}
        <span className={cn('relative inline-flex size-1.5 rounded-full', status.open ? 'bg-brand' : 'bg-muted-foreground')} />
      </span>
      {status.label}
    </span>
  )
}

export function mapsUrl(store: Store): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.address}, ${store.city}`)}`
}

/* ------------------------------------------------------------------------- */

const ALL = 'Todas'
const CITY_FILTERS = [ALL, ...new Set(STORES.map((s) => s.cityKey))]

export function LocationsPage() {
  const [city, setCity] = useState(ALL)
  const now = useNow()
  const visible = useMemo(() => (city === ALL ? STORES : STORES.filter((s) => s.cityKey === city)), [city])
  const openCount = STORES.filter((s) => getStoreStatus(s, now).open).length

  return (
    <Container className="pb-24">
      <PageHeader
        eyebrow="Ubicaciones"
        title="Seis tiendas, un mismo high score"
        description="Todas tienen consolas de demostración, recolección en tienda y devoluciones sin cita. Horario del centro de México."
      >
        <p className="mt-6 font-pixel text-xs tracking-wider text-muted-foreground uppercase">
          {openCount} de {STORES.length} abiertas ahora
        </p>
      </PageHeader>

      <Reveal className="mb-8 flex justify-center overflow-x-auto pb-1">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={city}
          onValueChange={(value) => value && setCity(value)}
          aria-label="Filtrar por ciudad"
        >
          {CITY_FILTERS.map((key) => (
            <ToggleGroupItem
              key={key}
              value={key}
              className="px-3 data-[state=on]:border-brand/60 data-[state=on]:bg-brand/10 data-[state=on]:text-brand"
            >
              {key}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Reveal>

      <motion.div layout className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((store, index) => (
            <motion.article
              key={store.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, delay: index * 0.05, ease: EASE_OUT } }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              whileHover={{ y: -4 }}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-6 transition-colors hover:border-brand/40"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-24 size-48 rounded-full bg-brand/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-pixel text-[10px] tracking-widest text-lavender uppercase">{store.city}</span>
                <StoreStatusBadge status={getStoreStatus(store, now)} />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{store.name}</h2>
                <p className="mt-2 flex gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  {store.address}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/50 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden /> Horario
                  </dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {hourLabel(store.opens)} – {hourLabel(store.closes)}
                  </dd>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="size-3.5" aria-hidden /> Teléfono
                  </dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    <a href={`tel:${store.phone.replace(/\s/g, '')}`} className="hover:text-brand">
                      {store.phone}
                    </a>
                  </dd>
                </div>
              </dl>
              <ul className="flex flex-wrap gap-1.5" aria-label="Servicios">
                {store.features.map((feature) => (
                  <li key={feature} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href={mapsUrl(store)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-1 self-start text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                Cómo llegar
                <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                <span className="sr-only">(abre Google Maps en una pestaña nueva)</span>
              </a>
            </motion.article>
          ))}
        </AnimatePresence>
      </motion.div>

      <Reveal className="mt-16 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        ¿Vas a recoger un pedido? Te avisamos por correo cuando esté listo, normalmente en 2 horas. Lleva tu folio{' '}
        <span className="font-pixel text-xs text-foreground">TICKET-…</span> y una identificación oficial.
      </Reveal>
    </Container>
  )
}
