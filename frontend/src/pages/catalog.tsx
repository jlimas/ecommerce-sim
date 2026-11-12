import { Loader2, PackageSearch, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { EASE_OUT } from '@/components/motion'
import { Container, EmptyState, ErrorState, PageHeader, ProductCard } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAsync } from '@/hooks/use-async'
import { api } from '@/lib/api'
import type { CategoryName, ProductQuery, ProductSort } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Query-string keys: every filtered view has its own shareable URL. */
const PARAM = {
  q: 'q',
  category: 'categoria',
  platform: 'plataforma',
  sort: 'orden',
  min: 'min',
  max: 'max',
} as const

const ALL = 'todas'
const MIN_SEARCH_LENGTH = 3
const SEARCH_DEBOUNCE_MS = 300

const CATEGORIES: CategoryName[] = ['Consolas', 'Videojuegos', 'Accesorios', 'Pantallas', 'Coleccionables']

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'priceAsc', label: 'Precio: menor a mayor' },
  { value: 'priceDesc', label: 'Precio: mayor a menor' },
  { value: 'discountDesc', label: 'Mayor descuento' },
  { value: 'nameAsc', label: 'Nombre A–Z' },
]

interface PriceBucket {
  value: string
  label: string
  min?: number
  max?: number
}

const PRICE_BUCKETS: PriceBucket[] = [
  { value: ALL, label: 'Cualquier precio' },
  { value: 'hasta-999', label: 'Hasta $999', max: 999 },
  { value: '1000-2999', label: '$1,000 a $2,999', min: 1000, max: 2999 },
  { value: '3000-9999', label: '$3,000 a $9,999', min: 3000, max: 9999 },
  { value: '10000-mas', label: '$10,000 o más', min: 10000 },
]
const CUSTOM_PRICE = 'personalizado'

function parsePrice(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const urlQ = searchParams.get(PARAM.q) ?? ''
  const category = searchParams.get(PARAM.category) ?? ''
  const platform = searchParams.get(PARAM.platform) ?? ''
  const sort = searchParams.get(PARAM.sort) ?? ''
  const minPrice = parsePrice(searchParams.get(PARAM.min))
  const maxPrice = parsePrice(searchParams.get(PARAM.max))

  // --- Search box: local draft, debounced into the URL (replace, so typing does not flood history).
  const [draft, setDraft] = useState(urlQ)
  const lastWrittenQ = useRef(urlQ)

  // Back/forward or "Limpiar filtros" changed the URL from outside the input: mirror it.
  useEffect(() => {
    if (urlQ !== lastWrittenQ.current) {
      lastWrittenQ.current = urlQ
      setDraft(urlQ)
    }
  }, [urlQ])

  useEffect(() => {
    const next = draft.trim()
    if (next === lastWrittenQ.current) return
    const timer = window.setTimeout(() => {
      lastWrittenQ.current = next
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next) params.set(PARAM.q, next)
          else params.delete(PARAM.q)
          return params
        },
        { replace: true, preventScrollReset: true },
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [draft, setSearchParams])

  /** Discrete filters (chips, selects) push a history entry so back/forward walks through them. */
  function updateParams(changes: Record<string, string | number | undefined>) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === '' || value === ALL) params.delete(key)
          else params.set(key, String(value))
        }
        return params
      },
      { preventScrollReset: true },
    )
  }

  function clearFilters() {
    lastWrittenQ.current = ''
    setDraft('')
    setSearchParams({}, { preventScrollReset: true })
  }

  // --- Products for the current URL. Only searches with at least 3 characters reach the API.
  const effectiveQ = urlQ.trim().length >= MIN_SEARCH_LENGTH ? urlQ.trim() : undefined
  const query: ProductQuery = {
    q: effectiveQ,
    category: category || undefined,
    platform: platform || undefined,
    sort: (sort || undefined) as ProductSort | undefined,
    minPrice,
    maxPrice,
  }
  const queryKey = JSON.stringify(query)
  const products = useAsync((signal) => api.listProducts(query, signal), [queryKey])

  // --- Platform options come from the live catalog, so they always match what the API accepts.
  const facets = useAsync((signal) => api.listProducts({}, signal), [])
  const platformOptions = useMemo(() => {
    const names = new Set((facets.data ?? []).map((product) => product.attributes.platform))
    if (platform) names.add(platform)
    return [...names].sort((a, b) => a.localeCompare(b, 'es'))
  }, [facets.data, platform])

  const priceValue = useMemo(() => {
    if (minPrice === undefined && maxPrice === undefined) return ALL
    const bucket = PRICE_BUCKETS.find((b) => b.value !== ALL && b.min === minPrice && b.max === maxPrice)
    return bucket?.value ?? CUSTOM_PRICE
  }, [minPrice, maxPrice])

  const hasFilters = Boolean(urlQ || category || platform || sort || minPrice !== undefined || maxPrice !== undefined)
  const draftTooShort = draft.trim().length > 0 && draft.trim().length < MIN_SEARCH_LENGTH
  const typingPending = draft.trim() !== urlQ.trim()
  const isRefreshing = products.status === 'loading' && products.data !== undefined
  const results = products.data ?? []
  const count = results.length

  return (
    <Container className="pb-24">
      <PageHeader
        eyebrow="Catálogo"
        title="Todo lo que se juega"
        description="Precios vigentes en MXN con el descuento ya aplicado. Sin límite de existencias."
      />

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: EASE_OUT }}
        className="relative z-20 -mx-4 md:sticky md:top-16 mb-6 border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Buscar productos</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Busca “mario”, “control”, “4K”…"
              className="h-10 pr-9 pl-9"
              aria-describedby="catalog-search-hint"
            />
            <AnimatePresence>
              {typingPending && !draftTooShort && (
                <motion.span
                  key="typing"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-brand"
                  aria-hidden
                >
                  <Loader2 className="size-4 animate-spin" />
                </motion.span>
              )}
            </AnimatePresence>
          </label>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:flex">
            <Select
              value={platform || ALL}
              onValueChange={(value) => updateParams({ [PARAM.platform]: value })}
            >
              <SelectTrigger className="h-10 w-full md:w-48" aria-label="Plataforma">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas las plataformas</SelectItem>
                {platformOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={priceValue}
              onValueChange={(value) => {
                const bucket = PRICE_BUCKETS.find((b) => b.value === value)
                if (bucket) updateParams({ [PARAM.min]: bucket.min, [PARAM.max]: bucket.max })
              }}
            >
              <SelectTrigger className="h-10 w-full md:w-44" aria-label="Precio">
                <SelectValue placeholder="Precio" />
              </SelectTrigger>
              <SelectContent>
                {PRICE_BUCKETS.map((bucket) => (
                  <SelectItem key={bucket.value} value={bucket.value}>
                    {bucket.label}
                  </SelectItem>
                ))}
                {priceValue === CUSTOM_PRICE && (
                  <SelectItem value={CUSTOM_PRICE} disabled>
                    Rango personalizado
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            <Select value={sort || 'relevance'} onValueChange={(value) => updateParams({ [PARAM.sort]: value === 'relevance' ? undefined : value })}>
              <SelectTrigger className="col-span-2 h-10 w-full sm:col-span-1 md:w-52" aria-label="Ordenar">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 -mb-1 overflow-x-auto pb-1">
          <ToggleGroup
            type="single"
            value={category || ALL}
            onValueChange={(value) => updateParams({ [PARAM.category]: value || ALL })}
            aria-label="Categoría"
            className="w-max"
          >
            {[ALL, ...CATEGORIES].map((value) => {
              const active = (category || ALL) === value
              return (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  size="sm"
                  className="relative isolate rounded-full px-3.5 data-[state=on]:bg-transparent data-[state=on]:text-brand-foreground"
                >
                  {active && (
                    <motion.span
                      layoutId="catalog-category-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-brand neon-glow"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{value === ALL ? 'Todas' : value}</span>
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </div>
      </motion.div>

      {/* Result meta */}
      <div className="mb-5 flex min-h-8 flex-wrap items-center justify-between gap-3 text-sm">
        <p id="catalog-search-hint" className="text-muted-foreground" aria-live="polite">
          {draftTooShort ? (
            <span>Escribe al menos {MIN_SEARCH_LENGTH} letras para buscar.</span>
          ) : products.status === 'error' ? null : products.data === undefined ? (
            <span>Cargando catálogo…</span>
          ) : (
            <motion.span key={`${queryKey}-${count}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <span className="font-pixel text-foreground">{count}</span> {count === 1 ? 'producto' : 'productos'}
              {effectiveQ && (
                <>
                  {' '}
                  para <span className="text-foreground">“{effectiveQ}”</span>
                </>
              )}
            </motion.span>
          )}
        </p>
        <AnimatePresence>
          {hasFilters && (
            <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X /> Limpiar filtros
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      {products.status === 'error' ? (
        <ErrorState message={products.error.message} onRetry={products.reload} />
      ) : products.data === undefined ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border bg-card">
              <Skeleton className="aspect-square rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : count === 0 && !isRefreshing ? (
        <EmptyState
          icon={PackageSearch}
          title="Sin resultados"
          description="Ningún producto cumple todos los filtros. Prueba con menos filtros."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <motion.div
          aria-busy={isRefreshing}
          animate={{ opacity: isRefreshing ? 0.5 : 1 }}
          transition={{ duration: 0.25 }}
          className={cn(
            'relative grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4',
            isRefreshing && 'pointer-events-none',
          )}
        >
          {/* popLayout: exiting cards leave the flow at once so the rest glide (layout) to their new slot. */}
          <AnimatePresence mode="popLayout">
            {results.map((product, index) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.45, delay: Math.min(index, 8) * 0.035, ease: EASE_OUT },
                }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
                transition={{ layout: { type: 'spring', stiffness: 380, damping: 36 } }}
                className="h-full"
              >
                {/* Hover lift lives on ProductCard; entrance/exit transforms stay on this wrapper. */}
                <ProductCard product={product} className="h-full" />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </Container>
  )
}
