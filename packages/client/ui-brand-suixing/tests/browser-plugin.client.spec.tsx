// @vitest-environment jsdom
/**
 * ui-brand-suixing browser half on a real cordis Context: the plugin fills the
 * sidebar's brand-mark and brand-name seats only under the suixing build
 * profile, leaves the official and local profiles untouched, and registers the
 * product name behind its own typed locale namespace rather than as a literal
 * in presentation code. The node half stays inert.
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSidebarCatalog } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { apply, inject } from '../src/client/index.ts'
import { SuiXingBrandMark, SuiXingBrandName } from '../src/client/Brand.tsx'
import { NS, zh, type SuiXingBrandKey } from '../src/client/locales.ts'
import { apply as hostApply } from '../src/index.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

const HOLES = ['sidebar.brand.mark', 'sidebar.brand.name'] as const

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: {
      ...Object.fromEntries(HOLES.map(name => [name, { kind: 'single', scope: 'root' }])),
      // ui-layout declares the main column; the directory registers into it.
      main: { kind: 'keyed', scope: 'root' },
    },
  } as never, () => null)
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('sidebarCatalog', createSidebarCatalog(() => {}))
  return { ctx, slots }
}

describe('SuiXing browser-brand plugin', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('declares only the services it uses', () => {
    expect(inject).toEqual(['locale', 'slots', 'sidebarCatalog'])
  })

  it('leaves the official and local builds unchanged', async () => {
    for (const profile of ['official', 'local']) {
      vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', profile)
      const subject = await bench()
      const fiber = subject.ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      for (const hole of HOLES) expect(subject.slots.entries(hole)).toHaveLength(0)
      await fiber.dispose()
    }
  })

  it('fills and removes both SuiXing brand slots', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'suixing')
    const subject = await bench()
    const fiber = subject.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    for (const hole of HOLES) expect(subject.slots.entries(hole)).toHaveLength(1)
    await fiber.dispose()
    for (const hole of HOLES) expect(subject.slots.entries(hole)).toHaveLength(0)
  })

  it('reads the product name through the suixing-brand namespace', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'suixing')
    const subject = await bench()
    const fiber = subject.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const [entry] = subject.slots.entries('sidebar.brand.name')
    expect(entry?.locale).toBe(NS)
  })

  it('renders the supplied logo and product name', () => {
    const name = render(<SuiXingBrandName t={key => zh[key as SuiXingBrandKey]} />)
    expect(name.getByText('SuiXing')).toBeTruthy()
    name.unmount()

    const mark = render(<SuiXingBrandMark size={24} />)
    const image = mark.container.querySelector('img')
    expect(image?.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
    expect(image?.getAttribute('width')).toBe('24')
    expect(image?.getAttribute('height')).toBe('24')
  })
})
