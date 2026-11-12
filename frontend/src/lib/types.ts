// Mirrors the Pydantic models in ../models.py (camelCase API contract).

export type Currency = 'MXN'

export type CategoryName = 'Consolas' | 'Videojuegos' | 'Accesorios' | 'Pantallas' | 'Coleccionables'

export interface ProductAttributes {
  brand: string
  platform: string
  category: CategoryName | string
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  listPrice: number
  discountPercent: number
  currency: Currency
  imageUrl: string
  tags: string[]
  attributes: ProductAttributes
}

export interface CartItem {
  productId: string
  quantity: number
}

export interface PaymentRequest {
  creditCardNumber: string
  pin: string
}

export interface PurchasedItem {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  totalPrice: number
}

export interface PaymentReceipt {
  status: string
  message: string
  ticketId: string
  paymentSummary: {
    totalAmount: number
    currency: Currency
    paymentMethod: { card: string }
  }
  purchasedItems: PurchasedItem[]
}

export type ProductSort = 'relevance' | 'priceAsc' | 'priceDesc' | 'discountDesc' | 'nameAsc'

export interface ProductQuery {
  platform?: string
  category?: string
  brand?: string
  tag?: string
  q?: string
  minPrice?: number
  maxPrice?: number
  sort?: ProductSort
  limit?: number
}
