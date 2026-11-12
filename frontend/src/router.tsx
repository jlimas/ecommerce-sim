import { createBrowserRouter, type RouteObject } from 'react-router'

import { RootLayout } from '@/components/layout/root-layout'
import { ROUTES } from '@/lib/site'
import { CatalogPage } from '@/pages/catalog'
import { CheckoutPage } from '@/pages/checkout'
import { HistoryPage } from '@/pages/history'
import { HomePage } from '@/pages/home'
import { LocationsPage } from '@/pages/locations'
import { NotFoundPage } from '@/pages/not-found'
import { ProductDetailPage } from '@/pages/product-detail'
import { ReturnsPage } from '@/pages/returns'
import { ShippingPage } from '@/pages/shipping'

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: ROUTES.home, element: <HomePage /> },
      { path: ROUTES.catalog, element: <CatalogPage /> },
      { path: `${ROUTES.catalog}/:productId`, element: <ProductDetailPage /> },
      { path: ROUTES.checkout, element: <CheckoutPage /> },
      { path: ROUTES.locations, element: <LocationsPage /> },
      { path: ROUTES.shipping, element: <ShippingPage /> },
      { path: ROUTES.returns, element: <ReturnsPage /> },
      { path: ROUTES.history, element: <HistoryPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
