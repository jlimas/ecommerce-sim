import { Check, Copy, ExternalLink, FileJson, KeyRound, Receipt, Terminal } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'

import { Reveal } from '@/components/motion/reveal'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { Container } from '@/components/shared/section'
import { ErrorState } from '@/components/shared/status-states'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/use-async'
import { API_BASE_URL } from '@/lib/api'
import { cn } from '@/lib/utils'

// Minimal slice of the OpenAPI 3 document this page renders.
interface OpenApiParameter {
  name: string
  in: string
  required?: boolean
  description?: string
  schema?: { type?: string; enum?: unknown[] }
}

interface OpenApiOperation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: OpenApiParameter[]
  requestBody?: unknown
}

interface OpenApiDocument {
  openapi: string
  info: { title: string; version: string; description?: string }
  servers?: { url: string; description?: string }[]
  tags?: { name: string; description?: string }[]
  paths: Record<string, Record<string, OpenApiOperation>>
}

interface Endpoint {
  method: string
  path: string
  operation: OpenApiOperation
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

const METHOD_STYLES: Record<string, string> = {
  get: 'bg-brand/15 text-brand',
  post: 'bg-glitch/15 text-glitch',
  put: 'bg-royal/20 text-lavender',
  patch: 'bg-royal/20 text-lavender',
  delete: 'bg-destructive/15 text-destructive',
}

const SPEC_PATH = `${API_BASE_URL}/openapi.json`
const DOCS_PATH = `${API_BASE_URL}/docs`

async function loadSpec(signal: AbortSignal): Promise<OpenApiDocument> {
  const response = await fetch(SPEC_PATH, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`No pudimos cargar el esquema OpenAPI (${response.status}).`)
  return (await response.json()) as OpenApiDocument
}

/** Groups operations by their first tag, keeping the order of the spec's `tags` list. */
function groupEndpoints(spec: OpenApiDocument): { tag: string; description?: string; endpoints: Endpoint[] }[] {
  const groups = new Map<string, Endpoint[]>()
  for (const [path, operations] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = operations[method]
      if (!operation) continue
      const tag = operation.tags?.[0] ?? 'Otros'
      groups.set(tag, [...(groups.get(tag) ?? []), { method, path, operation }])
    }
  }
  const order = spec.tags?.map((tag) => tag.name) ?? []
  return [...groups.entries()]
    .sort(([a], [b]) => (order.indexOf(a) + 1 || Infinity) - (order.indexOf(b) + 1 || Infinity))
    .map(([tag, endpoints]) => ({
      tag,
      description: spec.tags?.find((t) => t.name === tag)?.description,
      endpoints,
    }))
}

function useCopy(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (key: string, text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(key)
        window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600)
      })
      .catch(() => undefined)
  }
  return [copied, copy]
}

function CopyButton({ id, text, copied, onCopy }: { id: string; text: string; copied: string | null; onCopy: (key: string, text: string) => void }) {
  const done = copied === id
  return (
    <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => onCopy(id, text)} aria-label={done ? 'Copiado' : 'Copiar'}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={done ? 'done' : 'copy'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
          {done ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}

export function ApiDocsPage() {
  const spec = useAsync(loadSpec, [])
  const [copied, copy] = useCopy()
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const baseUrl = `${origin}${API_BASE_URL}`
  const specUrl = `${origin}${SPEC_PATH}`
  const groups = useMemo(() => (spec.data ? groupEndpoints(spec.data) : []), [spec.data])
  const operationCount = groups.reduce((sum, group) => sum + group.endpoints.length, 0)
  const rawSpec = useMemo(() => (spec.data ? JSON.stringify(spec.data, null, 2) : ''), [spec.data])

  const quickStart = [
    `curl ${baseUrl}/products?category=Videojuegos&sort=priceAsc&limit=3`,
    `curl -X POST ${baseUrl}/cart/cliente-demo -H 'Content-Type: application/json' -d '{"productId":"45467911","quantity":1}'`,
    `curl -X POST ${baseUrl}/payments/cliente-demo -H 'Content-Type: application/json' -d '{"creditCardNumber":"1111222233334444","pin":"4444"}'`,
  ].join('\n')

  const facts = [
    { icon: FileJson, label: 'Esquema OpenAPI', value: specUrl, copy: specUrl, href: SPEC_PATH },
    { icon: Terminal, label: 'URL base', value: baseUrl, copy: baseUrl },
    { icon: KeyRound, label: 'Autenticación', value: 'Ninguna. El carrito se identifica con un user_id que genera el cliente.' },
    { icon: Receipt, label: 'Pagos', value: 'Pasarela de prueba en MXN: usa tarjetas ficticias y el PIN igual a sus últimos 4 dígitos.' },
  ]

  return (
    <Container className="pb-8">
      <header className="mx-auto max-w-3xl py-16 text-center md:py-20">
        <Reveal y={8}>
          <p className="mb-4 font-pixel text-xs uppercase tracking-[0.3em] text-brand">Para desarrolladores y agentes</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance md:text-6xl">API de Arkanoid</h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-5 text-lg text-pretty text-muted-foreground">
            Consulta el catálogo, arma carritos y procesa pagos de prueba con la misma API que usa esta tienda. El contrato completo está
            publicado como OpenAPI {spec.data ? spec.data.openapi : '3'} y se puede importar directo en herramientas y agentes.
          </p>
        </Reveal>
        <Reveal delay={0.18} className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="neon-glow">
            <a href={SPEC_PATH} target="_blank" rel="noopener noreferrer">
              <FileJson /> Ver openapi.json
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={DOCS_PATH} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Documentación interactiva
            </a>
          </Button>
        </Reveal>
      </header>

      <Stagger className="grid gap-3 sm:grid-cols-2">
        {facts.map((fact) => (
          <StaggerItem key={fact.label} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy/60 text-brand">
              <fact.icon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-pixel text-[10px] uppercase tracking-widest text-muted-foreground">{fact.label}</p>
              {fact.href ? (
                <a href={fact.href} className="block truncate font-mono text-sm hover:text-brand" target="_blank" rel="noopener noreferrer">
                  {fact.value}
                </a>
              ) : (
                <p className={cn('text-sm', fact.copy && 'truncate font-mono')}>{fact.value}</p>
              )}
            </div>
            {fact.copy && <CopyButton id={fact.label} text={fact.copy} copied={copied} onCopy={copy} />}
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-12">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Inicio rápido</h2>
          <CopyButton id="quick-start" text={quickStart} copied={copied} onCopy={copy} />
        </div>
        <pre className="overflow-x-auto rounded-2xl border bg-card p-5 font-mono text-[13px] leading-relaxed text-muted-foreground">
          {quickStart.split('\n').map((line) => (
            <div key={line}>
              <span className="select-none text-brand">$ </span>
              {line}
            </div>
          ))}
        </pre>
      </Reveal>

      <section className="mt-16" aria-labelledby="endpoints">
        <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-pixel text-xs uppercase tracking-[0.3em] text-brand">Referencia</p>
            <h2 id="endpoints" className="mt-2 text-3xl font-semibold tracking-tight">
              Endpoints
            </h2>
          </div>
          {spec.data && (
            <p className="text-sm text-muted-foreground">
              {operationCount} operaciones · versión {spec.data.info.version}
            </p>
          )}
        </Reveal>

        {spec.status === 'error' && !spec.data && <ErrorState message={spec.error.message} onRetry={spec.reload} />}
        {!spec.data && spec.status === 'loading' && (
          <div className="grid gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-xl" />
            ))}
          </div>
        )}

        <div className="grid gap-10">
          {groups.map((group) => (
            <Reveal key={group.tag}>
              <h3 className="mb-1 text-lg font-semibold">{group.tag}</h3>
              {group.description && <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{group.description}</p>}
              <Accordion type="multiple" className="overflow-hidden rounded-2xl border">
                {group.endpoints.map(({ method, path, operation }) => (
                  <AccordionItem key={`${method} ${path}`} value={`${method} ${path}`} className="border-b last:border-b-0">
                    <AccordionTrigger className="gap-3 px-4 hover:bg-muted/40 hover:no-underline">
                      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left">
                        <Badge className={cn('w-16 justify-center font-mono uppercase', METHOD_STYLES[method])}>{method}</Badge>
                        <code className="font-mono text-sm break-all">{path}</code>
                        {operation.summary && <span className="text-sm font-normal text-muted-foreground">{operation.summary}</span>}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 px-4 pb-5">
                      {operation.operationId && (
                        <p className="text-xs text-muted-foreground">
                          operationId: <code className="font-mono text-foreground">{operation.operationId}</code>
                        </p>
                      )}
                      {operation.description && (
                        <p className="max-w-3xl whitespace-pre-line text-sm text-muted-foreground">{operation.description}</p>
                      )}
                      {operation.parameters && operation.parameters.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border">
                          <table className="w-full min-w-[520px] text-sm">
                            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2 font-medium">Parámetro</th>
                                <th className="px-3 py-2 font-medium">En</th>
                                <th className="px-3 py-2 font-medium">Descripción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {operation.parameters.map((param) => (
                                <tr key={`${param.in}-${param.name}`} className="border-t align-top">
                                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                                    {param.name}
                                    {param.required && <span className="text-glitch"> *</span>}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">{param.in}</td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {param.description}
                                    {param.schema?.enum && (
                                      <span className="mt-1 block font-mono text-xs">{param.schema.enum.map(String).join(' · ')}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          ))}
        </div>
      </section>

      {spec.data && (
        <Reveal className="mt-16">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Especificación completa</h2>
              <p className="text-sm text-muted-foreground">El mismo documento que sirve {SPEC_PATH}.</p>
            </div>
            <div className="flex items-center gap-1">
              <CopyButton id="raw-spec" text={rawSpec} copied={copied} onCopy={copy} />
              <Button asChild variant="outline" size="sm">
                <a href={SPEC_PATH} target="_blank" rel="noopener noreferrer">
                  Abrir JSON
                </a>
              </Button>
            </div>
          </div>
          <pre className="max-h-[32rem] overflow-auto rounded-2xl border bg-card p-5 font-mono text-xs leading-relaxed text-muted-foreground">
            {rawSpec}
          </pre>
        </Reveal>
      )}
    </Container>
  )
}
