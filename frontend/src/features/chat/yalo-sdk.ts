// Typed loader for the Yalo chat web SDK (a UMD script that exposes window.YaloChatSdk).

export const YALO_SDK_URL = 'https://chat-sdk-staging.yalochat.com/v1.0.0/sdk.js'

export const YALO_CHAT_CONFIG = {
  channelId: 'e97803a9-8854-4ae8-9220-f8bd71ab5abd',
  organizationId: '1000000220',
  // The SDK only uses channelName as the header title, so it carries the display name.
  channelName: 'Guía Arkanoid',
  image: '/arkanoid-avatar.png',
  locale: 'es-MX',
} as const

/** id of the container the chat window renders inside */
export const CHAT_TARGET_ID = 'yalo-chat'

export interface YaloChatClientConfig {
  channelId: string
  organizationId: string
  /** header title */
  channelName: string
  /** header avatar URL */
  image?: string
  /** UI language; the SDK ships en, es, es-MX, pt, pt-BR, ar, zh, zh-CN */
  locale?: 'en' | 'es' | 'es-MX' | 'pt' | 'pt-BR' | 'ar' | 'zh' | 'zh-CN'
  /** id of the element the chat window renders inside */
  target: string
}

export interface YaloChatClient {
  init(options?: { onOpen?: () => void; onClose?: () => void }): void
  open(): void
  close(): void
  dispose(): void
}

export interface YaloChatSdk {
  YaloChatClient: new (config: YaloChatClientConfig) => YaloChatClient
}

declare global {
  interface Window {
    YaloChatSdk?: YaloChatSdk
  }
}

let pending: Promise<YaloChatSdk> | null = null

/** Injects the SDK script once; concurrent callers share the same promise and a failed load can be retried. */
export function loadYaloSdk(src: string = YALO_SDK_URL): Promise<YaloChatSdk> {
  if (window.YaloChatSdk) return Promise.resolve(window.YaloChatSdk)
  if (pending) return pending

  pending = new Promise<YaloChatSdk>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.yaloSdk = ''
    script.onload = () => {
      if (window.YaloChatSdk) resolve(window.YaloChatSdk)
      else fail(new Error('Yalo SDK loaded but window.YaloChatSdk is missing'))
    }
    script.onerror = () => fail(new Error(`Failed to load Yalo SDK from ${src}`))
    function fail(error: Error) {
      script.remove()
      pending = null
      reject(error)
    }
    document.head.appendChild(script)
  })
  return pending
}

/** Test-only: forget the cached load so each test starts clean. */
export function resetYaloSdkForTests() {
  pending = null
  delete window.YaloChatSdk
  document.querySelectorAll('script[data-yalo-sdk]').forEach((el) => el.remove())
}
