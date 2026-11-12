const STORAGE_KEY = 'arkanoid.userId'

function randomId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `cliente-${random}`
}

/**
 * The API identifies carts by a client-generated user_id (no auth).
 * It is persisted per browser; storage failures (private mode) fall back to an in-memory id.
 */
let memoryId: string | null = null

export function getUserId(storage: Storage | undefined = globalThis.localStorage): string {
  try {
    const stored = storage?.getItem(STORAGE_KEY)
    if (stored) return stored
    const id = randomId()
    storage?.setItem(STORAGE_KEY, id)
    return id
  } catch {
    memoryId ??= randomId()
    return memoryId
  }
}
