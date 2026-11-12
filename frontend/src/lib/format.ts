const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

export function formatMXN(amount: number): string {
  return mxn.format(Number.isFinite(amount) ? amount : 0)
}

/** "1 pieza" / "3 piezas". */
export function formatPieces(quantity: number): string {
  return `${quantity} ${quantity === 1 ? 'pieza' : 'piezas'}`
}
