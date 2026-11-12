import { Link } from 'react-router'

import { Logo } from '@/components/layout/logo'
import { Container } from '@/components/shared/section'
import { HIDDEN_NAV, PRIMARY_NAV, STORE } from '@/lib/site'

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <Container className="grid gap-10 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{STORE.tagline}</p>
        </div>
        <nav aria-label="Pie de página">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">Tienda</p>
          <ul className="space-y-2 text-sm">
            {PRIMARY_NAV.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-muted-foreground transition-colors hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest">Contacto</p>
          <p>
            <a href={`mailto:${STORE.email}`} className="hover:text-foreground">
              {STORE.email}
            </a>
          </p>
          <p>{STORE.phone}</p>
        </div>
      </Container>
      <Container className="flex flex-col items-start justify-between gap-2 border-t py-6 text-xs text-muted-foreground/70 sm:flex-row sm:items-center">
        <p>
          © {new Date().getFullYear()} {STORE.name}. Precios en MXN. Pagos de prueba: no se realizan cargos reales.
        </p>
        <Link to={HIDDEN_NAV.to} className="text-muted-foreground/50 transition-colors hover:text-brand">
          {HIDDEN_NAV.label} ·
        </Link>
      </Container>
    </footer>
  )
}
