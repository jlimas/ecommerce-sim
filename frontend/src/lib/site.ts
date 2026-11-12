// Single source for navigation so header, footer and tests stay in sync.

export interface NavLink {
  to: string
  label: string
}

export const ROUTES = {
  home: '/',
  catalog: '/catalogo',
  product: (id: string) => `/catalogo/${id}`,
  checkout: '/pago',
  locations: '/ubicaciones',
  shipping: '/envios',
  returns: '/devoluciones',
  history: '/historia',
} as const

export const PRIMARY_NAV: NavLink[] = [
  { to: ROUTES.catalog, label: 'Catálogo' },
  { to: ROUTES.locations, label: 'Ubicaciones' },
  { to: ROUTES.shipping, label: 'Envíos' },
  { to: ROUTES.returns, label: 'Devoluciones' },
]

/** The store history is intentionally low-key: only linked from the footer fine print. */
export const HIDDEN_NAV: NavLink = { to: ROUTES.history, label: 'Nuestra historia' }

export const STORE = {
  name: 'Arkanoid',
  tagline: 'Videojuegos, consolas y nostalgia desde 1987.',
  email: 'hola@arkanoid.mx',
  phone: '55 1987 0420',
} as const
