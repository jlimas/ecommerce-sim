import { LoaderCircle, MessageCircle, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import './chat-widget.css'

import { CHAT_TARGET_ID, loadYaloSdk, YALO_CHAT_CONFIG, type YaloChatClient } from './yalo-sdk'

type Status = 'idle' | 'loading' | 'ready'

/**
 * Floating launcher for the Yalo shopping assistant. The SDK is only downloaded on the first open,
 * and the chat client lives for the whole session so the conversation survives route changes.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const clientRef = useRef<YaloChatClient | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clientRef.current?.dispose()
      clientRef.current = null
    }
  }, [])

  const openChat = useCallback(async () => {
    setOpen(true)
    if (clientRef.current) {
      clientRef.current.open()
      return
    }
    if (status === 'loading') return
    setStatus('loading')
    try {
      const sdk = await loadYaloSdk()
      if (!mountedRef.current) return
      const client = new sdk.YaloChatClient({ ...YALO_CHAT_CONFIG, target: CHAT_TARGET_ID })
      // The widget's own close button calls client.close(), which lands here.
      client.init({ onClose: () => setOpen(false) })
      client.open()
      clientRef.current = client
      setStatus('ready')
    } catch {
      if (!mountedRef.current) return
      setStatus('idle')
      setOpen(false)
      toast.error('No pudimos abrir el chat. Inténtalo de nuevo.')
    }
  }, [status])

  const closeChat = useCallback(() => {
    // client.close() fires onClose; without a client just hide the panel.
    if (clientRef.current) clientRef.current.close()
    else setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeChat()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closeChat])

  return (
    <>
      <section
        aria-label="Chat con Arkanoid"
        hidden={!open}
        className={cn(
          'fixed z-40 overflow-hidden rounded-2xl border bg-background shadow-2xl',
          // Phones: almost full screen above the launcher; desktop: 400x600 like the SDK sample.
          'inset-x-4 top-4 bottom-24 sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-24 sm:h-[600px] sm:max-h-[calc(100svh-8rem)] sm:w-[400px]',
        )}
      >
        {status === 'loading' && (
          <div role="status" className="absolute inset-0 grid place-items-center text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin" aria-hidden />
            <span className="sr-only">Cargando chat…</span>
          </div>
        )}
        <div id={CHAT_TARGET_ID} className="size-full" />
      </section>

      <Button
        size="icon"
        className="fixed right-6 bottom-6 z-40 size-14 rounded-full shadow-lg"
        aria-label={open ? 'Cerrar chat' : 'Abrir chat'}
        aria-expanded={open}
        onClick={open ? closeChat : openChat}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </Button>
    </>
  )
}
