import { CircleSlash, ShieldCheck, Wrench } from 'lucide-react'
import { Link } from 'react-router'

import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { PageHeader } from '@/components/shared/page-header'
import { Container } from '@/components/shared/section'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ROUTES } from '@/lib/site'
import {
  PolicyFaq,
  PolicyLayout,
  PolicySection,
  PolicySteps,
  type PolicySectionMeta,
  type PolicyStep,
} from '@/pages/shipping'

const SECTIONS = {
  terms: { id: 'plazos', title: 'Plazos por producto' },
  how: { id: 'como', title: 'Cómo devolver' },
  refunds: { id: 'reembolsos', title: 'Reembolsos' },
  warranty: { id: 'garantia', title: 'Garantía' },
  exceptions: { id: 'excepciones', title: 'Excepciones' },
  faq: { id: 'preguntas', title: 'Preguntas frecuentes' },
} satisfies Record<string, PolicySectionMeta>

const TERMS: { product: string; days: number; condition: string }[] = [
  { product: 'Videojuegos físicos', days: 30, condition: 'Sellados. Abiertos solo se cambian por defecto.' },
  { product: 'Consolas', days: 15, condition: 'Con caja, cables, manuales y sin daño físico.' },
  { product: 'Accesorios', days: 30, condition: 'En empaque original y con todas sus piezas.' },
  { product: 'Pantallas', days: 15, condition: 'Reporta daños de transporte en las primeras 48 horas.' },
  { product: 'Coleccionables', days: 30, condition: 'Sin abrir. La caja forma parte del producto.' },
]

const RETURN_STEPS: PolicyStep[] = [
  { title: 'Solicítalo', body: 'Escribe a devoluciones@arkanoid.mx con tu folio.' },
  { title: 'Recibe tu guía', body: 'Te mandamos una guía prepagada en menos de 24 horas.' },
  { title: 'Envía o visita', body: 'Entrégalo en paquetería o en cualquiera de nuestras tiendas.' },
  { title: 'Revisamos', body: 'Inspeccionamos el producto en 2 días hábiles.' },
]

const EXCEPTIONS = [
  'Códigos digitales y tarjetas de prepago ya revelados.',
  'Productos con daño causado por uso o golpes.',
  'Artículos de liquidación marcados como “Venta final”.',
]

const FAQ: [string, string][] = [
  [
    '¿Puedo cambiar un juego por otro en lugar de pedir reembolso?',
    'Sí. En tienda el cambio es inmediato; si pagas una diferencia, se cobra en el momento.',
  ],
  [
    'Me regalaron algo y no tengo el folio. ¿Qué hago?',
    'Con el nombre de quien compró y la fecha aproximada lo encontramos. El reembolso se hace como saldo Arkanoid.',
  ],
  [
    '¿Qué pasa si mi consola falla después de los 15 días?',
    'Entra la garantía del fabricante. Llévala a Roma Norte o Coyoacán y gestionamos el diagnóstico por ti.',
  ],
  ['¿Las preventas se pueden cancelar?', 'Sí, en cualquier momento antes del envío y con reembolso completo.'],
]

export function ReturnsPage() {
  return (
    <Container>
      <PageHeader
        eyebrow="Devoluciones y garantías"
        title="Si no era tu juego, se devuelve"
        description="Tienes 30 días naturales desde que recibes tu pedido. Sin preguntas incómodas, con algunas reglas claras."
      />
      <PolicyLayout sections={Object.values(SECTIONS)}>
        <PolicySection meta={SECTIONS.terms}>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Producto</TableHead>
                  <TableHead>Plazo</TableHead>
                  <TableHead className="pr-5">Condición</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TERMS.map((term) => (
                  <TableRow key={term.product}>
                    <TableCell className="pl-5 font-medium text-foreground">{term.product}</TableCell>
                    <TableCell>
                      <span
                        className={
                          term.days === 30
                            ? 'rounded-full bg-brand/10 px-2 py-0.5 font-pixel text-[11px] text-brand'
                            : 'rounded-full bg-lavender/15 px-2 py-0.5 font-pixel text-[11px] text-lavender'
                        }
                      >
                        {term.days} días
                      </span>
                    </TableCell>
                    <TableCell className="pr-5 whitespace-normal">{term.condition}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm">Los plazos cuentan en días naturales a partir de la fecha de entrega que registra la paquetería.</p>
        </PolicySection>

        <PolicySection meta={SECTIONS.how}>
          <PolicySteps steps={RETURN_STEPS} />
          <p>
            ¿Prefieres hacerlo en persona? Lleva el producto a cualquiera de nuestras{' '}
            <Link to={ROUTES.locations} className="text-brand underline-offset-4 hover:underline">
              seis tiendas
            </Link>{' '}
            con tu folio. No necesitas cita.
          </p>
        </PolicySection>

        <PolicySection meta={SECTIONS.refunds}>
          <p>
            Reembolsamos a la misma tarjeta con la que pagaste. El banco suele reflejarlo en{' '}
            <strong>5 a 10 días hábiles</strong> después de aprobar la devolución. Si prefieres, te damos saldo Arkanoid
            de inmediato con un 5% extra.
          </p>
          <p>El costo del envío original no se reembolsa, salvo que el producto llegue dañado o equivocado.</p>
        </PolicySection>

        <PolicySection meta={SECTIONS.warranty}>
          <Stagger className="grid gap-4 sm:grid-cols-2">
            <StaggerItem className="rounded-2xl border bg-card p-5">
              <ShieldCheck className="size-5 text-brand" aria-hidden />
              <p className="mt-3 font-medium text-foreground">12 meses de garantía del fabricante</p>
              <p className="mt-1 text-sm">En consolas y accesorios, en la mayoría de los casos.</p>
            </StaggerItem>
            <StaggerItem className="rounded-2xl border bg-card p-5">
              <Wrench className="size-5 text-lavender" aria-hidden />
              <p className="mt-3 font-medium text-foreground">Diagnóstico en tienda</p>
              <p className="mt-1 text-sm">En Roma Norte y Coyoacán revisamos el equipo y gestionamos la garantía por ti.</p>
            </StaggerItem>
          </Stagger>
        </PolicySection>

        <PolicySection meta={SECTIONS.exceptions}>
          <ul className="space-y-3">
            {EXCEPTIONS.map((item) => (
              <li key={item} className="flex gap-3">
                <CircleSlash className="mt-0.5 size-4 shrink-0 text-glitch" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </PolicySection>

        <PolicySection meta={SECTIONS.faq}>
          <PolicyFaq items={FAQ} />
        </PolicySection>
      </PolicyLayout>
    </Container>
  )
}
