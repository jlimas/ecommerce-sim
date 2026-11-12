import type { CartItem, PaymentReceipt, PaymentRequest, Product, ProductQuery } from '@/lib/types'

/** Base URL of the Arkanoid API. Empty means same origin (the Vite dev proxy). */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Turns FastAPI error bodies (`{detail: string}` or `{detail: ValidationIssue[]}`) into one message. */
export function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const { detail } = body as { detail: unknown }
    if (typeof detail === 'string' && detail.trim()) return detail
    if (Array.isArray(detail)) {
      const messages = detail
        .map((issue) => (issue && typeof issue === 'object' && 'msg' in issue ? String(issue.msg) : ''))
        .filter(Boolean)
      if (messages.length) return messages.join('. ')
    }
  }
  return fallback
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'No pudimos conectar con la tienda. Revisa tu conexión e inténtalo de nuevo.')
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, extractErrorMessage(body, `Error inesperado (${response.status}).`))
  }
  return body as T
}

export function buildProductQuery(query: ProductQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

/** Resolves a product imageUrl (relative to the API origin) to a loadable URL. */
export function resolveImageUrl(imageUrl: string): string {
  return /^https?:\/\//.test(imageUrl) ? imageUrl : `${API_BASE_URL}${imageUrl}`
}

const json = (data: unknown): RequestInit => ({ body: JSON.stringify(data) })
const userPath = (userId: string) => encodeURIComponent(userId)

export const api = {
  listProducts: (query: ProductQuery = {}, signal?: AbortSignal) =>
    request<Product[]>(`/products${buildProductQuery(query)}`, { signal }),
  getProduct: (productId: string, signal?: AbortSignal) =>
    request<Product>(`/products/${encodeURIComponent(productId)}`, { signal }),
  getCart: (userId: string, signal?: AbortSignal) => request<CartItem[]>(`/cart/${userPath(userId)}`, { signal }),
  addToCart: (userId: string, item: CartItem) =>
    request<CartItem[]>(`/cart/${userPath(userId)}`, { method: 'POST', ...json(item) }),
  updateCartItem: (userId: string, productId: string, quantity: number) =>
    request<CartItem[]>(`/cart/${userPath(userId)}/${encodeURIComponent(productId)}`, {
      method: 'PUT',
      ...json({ quantity }),
    }),
  removeFromCart: (userId: string, productId: string) =>
    request<CartItem[]>(`/cart/${userPath(userId)}/${encodeURIComponent(productId)}`, { method: 'DELETE' }),
  pay: (userId: string, payment: PaymentRequest) =>
    request<PaymentReceipt>(`/payments/${userPath(userId)}`, { method: 'POST', ...json(payment) }),
}
