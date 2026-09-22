// @vitest-environment jsdom
/**
 * SuiXing capability connections — 一切接插件.
 *
 * The contract these tests pin down is the product decision: every capability
 * runs on this machine with an empty configuration, and pointing one at the
 * platform is a per-capability choice with its own address. The table is the
 * plug-in point, so the tests also assert that every socket has copy and a
 * default path — a new platform capability that forgets either fails here.
 */
import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import { BridgesSection, type BridgesSectionProps } from '../src/client/bridges/BridgesSection.tsx'
import { BRIDGES_NS, en as bridgesEn, zh as bridgesZh } from '../src/client/bridges/locales.ts'
import {
  BRIDGES, DEFAULT_PLATFORM_BASE, EMPTY_BRIDGE_CONFIG, bridge, bridgeStatus, bridgeUrl,
  platformCount,
} from '../src/client/bridges/spec.ts'
import {
  createBridgesService, type BridgesService, type BridgesSnapshot,
} from '../src/client/bridges/store.ts'

afterEach(() => {
  cleanup()
  // The service persists on purpose, and jsdom shares one storage per file.
  localStorage.clear()
})

/** Translate stub over one dictionary, template params substituted. */
function translate(dict: Record<string, string>): BridgesSectionProps['t'] {
  return (key, params) => {
    const template = dict[key] ?? key
    if (params === undefined) return template
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template,
    )
  }
}

/** Chinese-dictionary translate stub. */
const zhT = translate(bridgesZh)

/** English-dictionary translate stub. */
const enT = translate(bridgesEn)

/** A selector hook over one live service, exactly as the renderer binds it. */
function bridgesHook(service: BridgesService): SnapshotSelectorHook<BridgesSnapshot> {
  return function useBridges<Selected>(select: (snapshot: BridgesSnapshot) => Selected): Selected {
    const subscribe = (listener: () => void): (() => void) => service.subscribe(listener)
    return useSyncExternalStore(subscribe, () => select(service.getSnapshot()))
  }
}

/** Render the page over one service, with the actions wired as production does. */
function mountSection(service: BridgesService, t: BridgesSectionProps['t'] = zhT) {
  return render(
    <BridgesSection
      useBridges={bridgesHook(service)}
      setBaseUrl={(url) => { service.setBaseUrl(url) }}
      setApiKey={(key) => { service.setApiKey(key) }}
      setMode={(id, mode) => { service.setMode(id, mode) }}
      setEndpoint={(id, endpoint) => { service.setEndpoint(id, endpoint) }}
      setAllModes={(mode) => { service.setAllModes(mode) }}
      t={t}
    />,
  )
}

/** The row of one socket, as the page exposes it. */
function row(name: string): HTMLElement {
  return screen.getByRole('group', { name })
}

/** The endpoint field of one socket. */
function endpointField(name: string): HTMLElement {
  return screen.getByLabelText(`${name} ${bridgesZh['row.endpoint.label']}`)
}

describe('SuiXing capability connections — the table', () => {
  it('gives every socket an id, copy, and a default path on the platform', () => {
    expect(BRIDGES).toHaveLength(6)
    const ids = BRIDGES.map(spec => spec.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const spec of BRIDGES) {
      expect(spec.path.startsWith('/')).toBe(true)
      expect(bridgesZh[spec.labelKey].trim()).not.toBe('')
      expect(bridgesEn[spec.labelKey].trim()).not.toBe('')
    }
    // The four creation capabilities are the ones the platform answers for.
    expect(BRIDGES.filter(spec => spec.centre === 'creation').map(spec => spec.id))
      .toEqual(['ppt', 'image', 'video', 'music'])
    expect(bridge('image')?.path).toBe('/openapi/v1/generations/image')
    expect(bridge('nope')).toBeUndefined()
    expect(DEFAULT_PLATFORM_BASE).toBe('https://agent.35sz.top')
  })

  it('fills every key in both dictionaries', () => {
    expect(BRIDGES_NS).toBe('suixing-bridges')
    for (const key of Object.keys(bridgesZh)) {
      expect(bridgesZh[key as keyof typeof bridgesZh]?.trim()).not.toBe('')
      expect(bridgesEn[key as keyof typeof bridgesEn]?.trim()).not.toBe('')
    }
  })
})

describe('SuiXing capability connections — resolving an address', () => {
  const image = bridge('image')!

  it('keeps everything local, and addressless, until an origin is given', () => {
    expect(bridgeUrl(EMPTY_BRIDGE_CONFIG, image)).toBe('')
    expect(bridgeStatus(EMPTY_BRIDGE_CONFIG, image)).toBe('local')
    expect(platformCount(EMPTY_BRIDGE_CONFIG)).toBe(0)
  })

  it('joins the origin with the socket default, tolerant of a trailing slash', () => {
    const config = { ...EMPTY_BRIDGE_CONFIG, baseUrl: 'https://agent.35sz.top/' }
    expect(bridgeUrl(config, image)).toBe('https://agent.35sz.top/openapi/v1/generations/image')
  })

  it('lets one capability override its path, with or without the leading slash', () => {
    const config = {
      baseUrl: 'https://agent.35sz.top',
      apiKey: '',
      modes: { image: 'platform' as const },
      endpoints: { image: 'v2/create-image' },
    }
    expect(bridgeUrl(config, image)).toBe('https://agent.35sz.top/v2/create-image')
    expect(bridgeStatus(config, image)).toBe('ready')
  })

  it('lets one capability point at a different host entirely', () => {
    const config = {
      baseUrl: 'https://agent.35sz.top',
      apiKey: '',
      modes: { music: 'platform' as const },
      endpoints: { music: 'https://audio.35sz.top/generate' },
    }
    expect(bridgeUrl(config, bridge('music')!)).toBe('https://audio.35sz.top/generate')
    expect(bridgeStatus(config, bridge('music')!)).toBe('ready')
  })

  it('calls a platform socket without an address pending, never ready', () => {
    const config = { ...EMPTY_BRIDGE_CONFIG, modes: { image: 'platform' as const } }
    expect(bridgeStatus(config, image)).toBe('pending')
    expect(platformCount(config)).toBe(1)
  })

  it('counts the sockets pointed at the platform', () => {
    const config = {
      baseUrl: 'https://agent.35sz.top',
      apiKey: '',
      modes: { image: 'platform' as const, agents: 'platform' as const },
      endpoints: {},
    }
    expect(platformCount(config)).toBe(2)
  })
})

describe('SuiXing capability connections — the store', () => {
  it('starts with everything local and no origin', () => {
    expect(createBridgesService().getSnapshot()).toEqual(EMPTY_BRIDGE_CONFIG)
  })

  it('records the origin, one socket at a time, and one endpoint at a time', () => {
    const bridges = createBridgesService()
    bridges.setBaseUrl('https://agent.35sz.top')
    bridges.setMode('image', 'platform')
    bridges.setEndpoint('image', 'https://agent.35sz.top/create-image')
    expect(bridges.getSnapshot()).toMatchObject({
      baseUrl: 'https://agent.35sz.top',
      apiKey: '',
      modes: { image: 'platform' },
      endpoints: { image: 'https://agent.35sz.top/create-image' },
    })
  })

  it('switches every socket in one step, and back', () => {
    const bridges = createBridgesService()
    bridges.setAllModes('platform')
    expect(platformCount(bridges.getSnapshot())).toBe(BRIDGES.length)
    bridges.setAllModes('local')
    expect(platformCount(bridges.getSnapshot())).toBe(0)
    // The table, not a copy of it: every known socket has an entry.
    expect(Object.keys(bridges.getSnapshot().modes)).toEqual(BRIDGES.map(spec => spec.id))
  })

  it('clears an override with an empty endpoint rather than deleting the socket', () => {
    const bridges = createBridgesService()
    bridges.setBaseUrl('https://agent.35sz.top')
    bridges.setMode('video', 'platform')
    bridges.setEndpoint('video', '/v2/video')
    expect(bridgeUrl(bridges.getSnapshot(), bridge('video')!)).toBe('https://agent.35sz.top/v2/video')
    bridges.setEndpoint('video', '')
    expect(bridgeUrl(bridges.getSnapshot(), bridge('video')!)).toBe('https://agent.35sz.top/openapi/v1/generations/video')
  })

  it('notifies subscribers when a socket moves', () => {
    const bridges = createBridgesService()
    let seen = 0
    const stop = bridges.subscribe(() => { seen += 1 })
    bridges.setMode('ppt', 'platform')
    bridges.setEndpoint('ppt', '/v2/deck')
    stop()
    bridges.setMode('ppt', 'local')
    expect(seen).toBe(2)
  })
})

describe('SuiXing capability connections — the settings page', () => {
  it('shows every socket as local, and says so', () => {
    mountSection(createBridgesService())
    expect(screen.getByText(bridgesZh['section.title'])).toBeTruthy()
    expect(screen.getAllByText(bridgesZh['state.local'])).toHaveLength(BRIDGES.length)
    expect(screen.getByText('走平台 0 / 6 项')).toBeTruthy()
    for (const spec of BRIDGES) expect(screen.getByText(bridgesZh[spec.labelKey])).toBeTruthy()
  })

  it('turns one socket on, shows the address it resolves to, and resets it', () => {
    const bridges = createBridgesService()
    mountSection(bridges)
    const name = bridgesZh['bridge.image']

    fireEvent.click(within(row(name)).getByText(bridgesZh['row.platform']))
    expect(bridges.getSnapshot().modes.image).toBe('platform')
    // Pointed at the platform, no origin yet: the row asks for the address.
    expect(screen.getByText(bridgesZh['state.pending'])).toBeTruthy()

    fireEvent.change(endpointField(name), {
      target: { value: 'https://agent.35sz.top/create-image' },
    })
    expect(screen.getByText('接平台：https://agent.35sz.top/create-image')).toBeTruthy()
    expect(screen.getByText('走平台 1 / 6 项')).toBeTruthy()

    fireEvent.click(screen.getByText(bridgesZh['row.reset']))
    expect(bridges.getSnapshot().endpoints.image).toBe('')
    expect(screen.queryByText(bridgesZh['row.reset'])).toBeNull()
  })

  it('drives the origin field and the bulk switches', () => {
    const bridges = createBridgesService()
    mountSection(bridges)

    fireEvent.change(screen.getByPlaceholderText(DEFAULT_PLATFORM_BASE), {
      target: { value: DEFAULT_PLATFORM_BASE },
    })
    expect(bridges.getSnapshot().baseUrl).toBe(DEFAULT_PLATFORM_BASE)

    // With an origin recorded, a socket switched on resolves immediately to the
    // table's default path — no extra step for the user.
    fireEvent.click(within(row(bridgesZh['bridge.ppt'])).getByText(bridgesZh['row.platform']))
    expect(bridges.getSnapshot().modes.ppt).toBe('platform')
    expect(screen.getByText('接平台：https://agent.35sz.top/openapi/v1/creator/ppt')).toBeTruthy()

    fireEvent.click(screen.getByText(bridgesZh['bulk.platform']))
    expect(screen.getByText('走平台 6 / 6 项')).toBeTruthy()
    fireEvent.click(screen.getByText(bridgesZh['bulk.local']))
    expect(screen.getByText('走平台 0 / 6 项')).toBeTruthy()
  })

  it('reads the English dictionary through the same page', () => {
    const bridges = createBridgesService()
    mountSection(bridges, enT)
    expect(screen.getByText(bridgesEn['section.title'])).toBeTruthy()
    expect(screen.getByText(bridgesEn['bridge.image'])).toBeTruthy()
    expect(screen.getByText('0 of 6 set for the platform')).toBeTruthy()
  })
})
