import { afterEach, describe, expect, it } from 'vitest'

import { loadYaloSdk, resetYaloSdkForTests, YALO_SDK_INTEGRITY, YALO_SDK_URL, type YaloChatSdk } from './yalo-sdk'

const fakeSdk = { YaloChatClient: class {} } as unknown as YaloChatSdk

function sdkScripts() {
  return document.querySelectorAll<HTMLScriptElement>('script[data-yalo-sdk]')
}

afterEach(() => resetYaloSdkForTests())

describe('loadYaloSdk', () => {
  it('resolves immediately when the SDK is already on window', async () => {
    window.YaloChatSdk = fakeSdk
    await expect(loadYaloSdk()).resolves.toBe(fakeSdk)
    expect(sdkScripts()).toHaveLength(0)
  })

  it('injects the script once and shares the promise between callers', async () => {
    const first = loadYaloSdk('https://example.test/sdk.js')
    const second = loadYaloSdk('https://example.test/sdk.js')
    expect(second).toBe(first)
    expect(sdkScripts()).toHaveLength(1)
    expect(sdkScripts()[0].src).toBe('https://example.test/sdk.js')
    expect(sdkScripts()[0].integrity).toBe(YALO_SDK_INTEGRITY)
    expect(sdkScripts()[0].crossOrigin).toBe('anonymous')

    window.YaloChatSdk = fakeSdk
    sdkScripts()[0].onload?.(new Event('load'))
    await expect(first).resolves.toBe(fakeSdk)
  })

  it('rejects when the script loads without exposing the global, and allows a retry', async () => {
    const attempt = loadYaloSdk()
    sdkScripts()[0].onload?.(new Event('load'))
    await expect(attempt).rejects.toThrow('window.YaloChatSdk is missing')
    expect(sdkScripts()).toHaveLength(0)

    const retry = loadYaloSdk()
    expect(retry).not.toBe(attempt)
    expect(sdkScripts()).toHaveLength(1)
    retry.catch(() => {})
  })

  it('defaults to the pinned staging bundle with its SRI hash', () => {
    loadYaloSdk().catch(() => {})
    expect(YALO_SDK_URL).toMatch(/^https:\/\/chat-sdk-staging\.yalochat\.com\/v\d+\.\d+\.\d+\/sdk\.js$/)
    expect(sdkScripts()[0].src).toBe(YALO_SDK_URL)
    expect(sdkScripts()[0].integrity).toMatch(/^sha384-/)
  })

  it('rejects and removes the script on a network error', async () => {
    const attempt = loadYaloSdk('https://example.test/broken.js')
    sdkScripts()[0].onerror?.(new Event('error'))
    await expect(attempt).rejects.toThrow('Failed to load Yalo SDK from https://example.test/broken.js')
    expect(sdkScripts()).toHaveLength(0)
  })
})
