import { createBrowserRouter, type RouteObject } from 'react-router'

import { RootLayout } from '@/components/layout/root-layout'
import { ROUTES } from '@/lib/site'

// Each page is its own chunk, loaded on first navigation.
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: ROUTES.home, lazy: async () => ({ Component: (await import('@/pages/home')).HomePage }) },
      { path: ROUTES.catalog, lazy: async () => ({ Component: (await import('@/pages/catalog')).CatalogPage }) },
      {
        path: `${ROUTES.catalog}/:productId`,
        lazy: async () => ({ Component: (await import('@/pages/product-detail')).ProductDetailPage }),
      },
      { path: ROUTES.checkout, lazy: async () => ({ Component: (await import('@/pages/checkout')).CheckoutPage }) },
      { path: ROUTES.locations, lazy: async () => ({ Component: (await import('@/pages/locations')).LocationsPage }) },
      { path: ROUTES.shipping, lazy: async () => ({ Component: (await import('@/pages/shipping')).ShippingPage }) },
      { path: ROUTES.returns, lazy: async () => ({ Component: (await import('@/pages/returns')).ReturnsPage }) },
      { path: ROUTES.api, lazy: async () => ({ Component: (await import('@/pages/api-docs')).ApiDocsPage }) },
      { path: ROUTES.history, lazy: async () => ({ Component: (await import('@/pages/history')).HistoryPage }) },
      { path: '*', lazy: async () => ({ Component: (await import('@/pages/not-found')).NotFoundPage }) },
    ],
  },
]

export const router = createBrowserRouter(routes)
