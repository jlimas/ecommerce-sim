import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatWidget } from './chat-widget'
import {
  CHAT_TARGET_ID,
  loadYaloSdk,
  YALO_CHAT_CONFIG, type YaloChatClient, type YaloChatClientConfig } from './yalo-sdk'

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }))

vi.mock('./yalo-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./yalo-sdk')>()
  return { ...actual, loadYaloSdk: vi.fn() }
})

type Handlers = { onOpen?: () => void; onClose?: () => void }

class FakeClient implements YaloChatClient {
  static instances: FakeClient[] = []
  handlers: Handlers = {}
  init = vi.fn((options?: Handlers) => {
    this.handlers = options ?? {}
  })
  open = vi.fn()
  close = vi.fn(() => this.handlers.onClose?.())
  dispose = vi.fn()
  config: YaloChatClientConfig
  constructor(config: YaloChatClientConfig) {
    this.config = config
    FakeClient.instances.push(this)
  }
}

const loadMock = vi.mocked(loadYaloSdk)

function launcher() {
  return screen.getByRole('button', { name: /chat/i })
}

function panel() {
  // Hidden regions drop out of the accessibility tree, so query the DOM directly.
  const el = document.querySelector<HTMLElement>('section[aria-label="Chat con Arkanoid"]')
  if (!el) throw new Error('chat panel not rendered')
  return el
}

beforeEach(() => {
  FakeClient.instances = []
  toastError.mockReset()
  loadMock.mockReset()
  loadMock.mockResolvedValue({ YaloChatClient: FakeClient })
})

describe('ChatWidget', () => {
  it('starts closed without downloading the SDK', () => {
    render(<ChatWidget />)
    expect(launcher()).toHaveAccessibleName('Abrir chat')
    expect(launcher()).toHaveAttribute('aria-expanded', 'false')
    expect(panel()).not.toBeVisible()
    expect(loadMock).not.toHaveBeenCalled()
  })

  it('loads the SDK on first open and renders the client into the target container', async () => {
    render(<ChatWidget />)
    await userEvent.click(launcher())

    await waitFor(() => expect(FakeClient.instances).toHaveLength(1))
    const client = FakeClient.instances[0]
    expect(client.config).toEqual({ ...YALO_CHAT_CONFIG, target: CHAT_TARGET_ID })
    expect(document.getElementById(CHAT_TARGET_ID)).toBeInTheDocument()
    expect(client.init).toHaveBeenCalledOnce()
    expect(client.open).toHaveBeenCalledOnce()
    expect(panel()).toBeVisible()
    expect(launcher()).toHaveAccessibleName('Cerrar chat')
    expect(launcher()).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows a loader while the SDK downloads', async () => {
    let resolve!: (sdk: { YaloChatClient: typeof FakeClient }) => void
    loadMock.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<ChatWidget />)
    await userEvent.click(launcher())

    expect(screen.getByRole('status')).toHaveTextContent('Cargando chat…')
    resolve({ YaloChatClient: FakeClient })
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('reuses the same client when reopened instead of creating a new conversation', async () => {
    render(<ChatWidget />)
    await userEvent.click(launcher())
    await waitFor(() => expect(FakeClient.instances).toHaveLength(1))

    await userEvent.click(launcher())
    expect(FakeClient.instances[0].close).toHaveBeenCalledOnce()
    expect(panel()).not.toBeVisible()

    await userEvent.click(launcher())
    expect(FakeClient.instances).toHaveLength(1)
    expect(FakeClient.instances[0].open).toHaveBeenCalledTimes(2)
    expect(loadMock).toHaveBeenCalledOnce()
    expect(panel()).toBeVisible()
  })

  it('hides the panel when the widget closes itself', async () => {
    render(<ChatWidget />)
    await userEvent.click(launcher())
    await waitFor(() => expect(FakeClient.instances).toHaveLength(1))

    // Simulates the SDK's own close button (client.close() -> onClose).
    FakeClient.instances[0].close()
    await waitFor(() => expect(panel()).not.toBeVisible())
    expect(launcher()).toHaveAccessibleName('Abrir chat')
  })

  it('closes on Escape', async () => {
    render(<ChatWidget />)
    await userEvent.click(launcher())
    await waitFor(() => expect(FakeClient.instances).toHaveLength(1))

    await userEvent.keyboard('{Escape}')
    expect(FakeClient.instances[0].close).toHaveBeenCalledOnce()
    expect(panel()).not.toBeVisible()
  })

  it('reports a load failure, stays closed and lets the user retry', async () => {
    loadMock.mockRejectedValueOnce(new Error('network'))
    render(<ChatWidget />)
    await userEvent.click(launcher())

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('No pudimos abrir el chat. Inténtalo de nuevo.'))
    expect(panel()).not.toBeVisible()
    expect(FakeClient.instances).toHaveLength(0)

    await userEvent.click(launcher())
    await waitFor(() => expect(FakeClient.instances).toHaveLength(1))
    expect(panel()).toBeVisible()
  })

  it('disposes the client on unmount', async () => {
    const { unmount } = render(<ChatWidget />)
    await userEvent.click(launcher())
    await waitFor(() => expect(FakeClient.instances).toHaveLength(1))

    unmount()
    expect(FakeClient.instances[0].dispose).toHaveBeenCalledOnce()
  })

  it('does not create a client if it unmounts while the SDK is loading', async () => {
    let resolve!: (sdk: { YaloChatClient: typeof FakeClient }) => void
    loadMock.mockReturnValue(new Promise((r) => (resolve = r)))
    const { unmount } = render(<ChatWidget />)
    await userEvent.click(launcher())

    unmount()
    resolve({ YaloChatClient: FakeClient })
    await Promise.resolve()
    expect(FakeClient.instances).toHaveLength(0)
  })
})
