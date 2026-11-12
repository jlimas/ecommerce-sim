import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { api } from '@/lib/api'
import type { CartItem, PaymentReceipt, PaymentRequest, Product } from '@/lib/types'
import { getUserId } from '@/lib/user-id'

export interface CartLine {
  item: CartItem
  /** Undefined while the product details are still loading. */
  product: Product | undefined
  lineTotal: number
}

export interface CartContextValue {
  userId: string
  items: CartItem[]
  lines: CartLine[]
  totalPieces: number
  subtotal: number
  status: 'loading' | 'ready' | 'error'
  error: string | undefined
  /** Product ids with a mutation in flight. */
  pendingIds: ReadonlySet<string>
  isOpen: boolean
  setOpen: (open: boolean) => void
  add: (product: Product, quantity?: number) => Promise<void>
  setQuantity: (productId: string, quantity: number) => Promise<void>
  remove: (productId: string) => Promise<void>
  checkout: (payment: PaymentRequest) => Promise<PaymentReceipt>
  refresh: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children, userId: userIdProp }: { children: ReactNode; userId?: string }) {
  const userId = useMemo(() => userIdProp ?? getUserId(), [userIdProp])
  const [items, setItems] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Record<string, Product>>({})
  const [status, setStatus] = useState<CartContextValue['status']>('loading')
  const [error, setError] = useState<string>()
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const [isOpen, setOpen] = useState(false)
  // Every mutation returns the full cart; only the latest response may win.
  const requestSeq = useRef(0)

  const applyCart = useCallback((seq: number, cart: CartItem[]) => {
    if (seq === requestSeq.current) setItems(cart)
  }, [])

  const rememberProduct = useCallback((product: Product) => {
    setProducts((prev) => (prev[product.id] ? prev : { ...prev, [product.id]: product }))
  }, [])

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current
    try {
      applyCart(seq, await api.getCart(userId))
      setStatus('ready')
      setError(undefined)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [applyCart, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Load details for cart items we have not seen yet (e.g. a cart restored after reload).
  const missingIds = items.map((item) => item.productId).filter((id) => !products[id])
  const missingKey = missingIds.join(',')
  useEffect(() => {
    if (!missingKey) return
    const controller = new AbortController()
    for (const id of missingKey.split(',')) {
      api
        .getProduct(id, controller.signal)
        .then(rememberProduct)
        .catch(() => undefined)
    }
    return () => controller.abort()
  }, [missingKey, rememberProduct])

  const mutate = useCallback(
    async (productId: string, run: () => Promise<CartItem[]>) => {
      const seq = ++requestSeq.current
      setPendingIds((prev) => new Set(prev).add(productId))
      try {
        applyCart(seq, await run())
        setError(undefined)
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(productId)
          return next
        })
      }
    },
    [applyCart],
  )

  const add = useCallback(
    async (product: Product, quantity = 1) => {
      rememberProduct(product)
      await mutate(product.id, () => api.addToCart(userId, { productId: product.id, quantity }))
    },
    [mutate, rememberProduct, userId],
  )

  const setQuantity = useCallback(
    (productId: string, quantity: number) =>
      mutate(productId, () =>
        quantity <= 0 ? api.removeFromCart(userId, productId) : api.updateCartItem(userId, productId, quantity),
      ),
    [mutate, userId],
  )

  const remove = useCallback(
    (productId: string) => mutate(productId, () => api.removeFromCart(userId, productId)),
    [mutate, userId],
  )

  const checkout = useCallback(
    async (payment: PaymentRequest) => {
      const receipt = await api.pay(userId, payment)
      requestSeq.current += 1
      setItems([]) // The API empties the cart after a successful payment.
      return receipt
    },
    [userId],
  )

  const value = useMemo<CartContextValue>(() => {
    const lines = items.map((item) => {
      const product = products[item.productId]
      return { item, product, lineTotal: product ? product.price * item.quantity : 0 }
    })
    return {
      userId,
      items,
      lines,
      totalPieces: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100,
      status,
      error,
      pendingIds,
      isOpen,
      setOpen,
      add,
      setQuantity,
      remove,
      checkout,
      refresh,
    }
  }, [items, products, userId, status, error, pendingIds, isOpen, add, setQuantity, remove, checkout, refresh])

  return <CartContext value={value}>{children}</CartContext>
}

export function useCart(): CartContextValue {
  const context = use(CartContext)
  if (!context) throw new Error('useCart must be used inside <CartProvider>')
  return context
}
