import { RouterProvider } from 'react-router'

import { CartProvider } from '@/features/cart/cart-context'
import { router } from '@/router'

export default function App() {
  return (
    <CartProvider>
      <RouterProvider router={router} />
    </CartProvider>
  )
}
