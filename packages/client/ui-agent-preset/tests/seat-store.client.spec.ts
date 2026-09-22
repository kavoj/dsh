// @vitest-environment jsdom
/**
 * The mode seat's roster filter: the picker lists what a person may pick —
 * healthy presets, minus role presets a flow assigns programmatically
 * (`pickable: false`). The full roster stays available to the surfaces that
 * label and manage presets, which is why the filter lives in the seat's own
 * load, not in the shared projection.
 */

import { describe, expect, it, vi } from 'vitest'
import { AgentPresetSeatController } from '../src/client/seat-store.ts'

function ctxWith(presets: readonly unknown[]) {
  return {
    remote: {
      agentPresets: {
        list: vi.fn(() => Promise.resolve({
          ok: true,
          value: { presets, authorable: false, modeSelectionEnabled: true },
        })),
        select: vi.fn(),
      },
    },
  } as never
}

describe("the seat's roster filter", () => {
  it('offers pickable presets and hides role presets marked unpickable', async () => {
    const controller = new AgentPresetSeatController(ctxWith([
      { id: 'standard', trust: 'system', isDefault: true },
      { id: 'suixing-chief', trust: 'system', name: '总裁决策官', pickable: false },
    ]), () => undefined)
    await controller.load()
    expect(controller.store.getSnapshot().options.map(option => option.id)).toEqual(['standard'])
    // The unpickable default must not disturb the staged/default display.
    expect(controller.store.getSnapshot().current).toBe('standard')
  })

  it('keeps every healthy preset offered when none is marked unpickable', async () => {
    const controller = new AgentPresetSeatController(ctxWith([
      { id: 'standard', trust: 'system', isDefault: true },
      { id: 'ptc', trust: 'system' },
    ]), () => undefined)
    await controller.load()
    expect(controller.store.getSnapshot().options.map(option => option.id)).toEqual(['standard', 'ptc'])
  })
})
