// @vitest-environment jsdom
/**
 * SuiXing conversations for capabilities.
 *
 * Two product decisions are pinned here. First: a conversation a capability
 * starts is an ordinary Session, so nothing about this feature may invent a
 * second kind of conversation — the binding is a browser-local note and the
 * rows are a projection of the Host's own Session list. Second: "开始对话"
 * creates that Session outside every Workspace — the capability's menu is its
 * only home, the workspace tree never claims it, and the binding is written
 * before the conversation opens, because that is the only moment the caller
 * learns the Session id.
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import { createThreadLauncher, threadServices } from '../src/client/threads/launcher.ts'
import { THREAD_VISIBLE_LIMIT, liveThreads, threadRows } from '../src/client/threads/spec.ts'
import {
  THREADS_PERSIST_NAME, createThreadsService, type ThreadsService,
} from '../src/client/threads/store.ts'
import { presetFor } from '../src/client/presets/spec.ts'
import { AGENT_IDS } from '../src/client/directory/specs.ts'
import { createRolePresets, type RolePresets } from '../src/client/presets/index.ts'

afterEach(() => {
  // The store persists on purpose, and jsdom shares one storage per file.
  localStorage.clear()
})

/** One binding, as the store records it. */
function record(capabilityId: string, sessionId: string, startedAt = 1) {
  return { capabilityId, sessionId, startedAt }
}

/** One Session summary, with only the facts a nested row reads. */
function summary(updatedAt: number, extra: Partial<{
  displayTitle: string
  title: string
  blank: boolean
  running: boolean
}> = {}) {
  return { displayTitle: 'T', blank: false, running: false, ...extra, updatedAt }
}

describe('capability conversations — the rows', () => {
  it('projects the conversations a capability started, newest first', () => {
    const rows = threadRows(
      [record('chief', 's1', 10), record('chief', 's2', 20), record('other', 's3', 30)],
      { s1: summary(100, { displayTitle: '旧' }), s2: summary(200, { displayTitle: '新' }) },
      undefined,
    )
    expect(rows.map(row => row.sessionId)).toEqual(['s2', 's1'])
    expect(rows.map(row => row.title)).toEqual(['新', '旧'])
  })

  it('drops a conversation the Host no longer lists, instead of a door to nothing', () => {
    const rows = threadRows([record('chief', 'gone')], {}, undefined)
    expect(rows).toEqual([])
  })

  it('hides an archived conversation while keeping its binding alive', () => {
    const rows = threadRows(
      [record('chief', 's1'), record('chief', 's2', 2)],
      { s1: summary(100, { displayTitle: '归档的' }), s2: summary(200, { displayTitle: '在的' }) },
      undefined,
      new Set(['s1']),
    )
    expect(rows.map(row => row.sessionId)).toEqual(['s2'])
  })

  it('leaves an unnamed conversation titleless, for the sidebar to name', () => {
    const rows = threadRows([record('chief', 's1')], { s1: summary(1, { blank: true }) }, undefined)
    expect(rows[0]?.title).toBe('')
  })

  it('shows an explicit name even while the conversation is still blank', () => {
    // A rename of a never-spoken-in conversation sets `title` without
    // flipping `blank`; the chosen name must win over the placeholder.
    const rows = threadRows(
      [record('chief', 's1')],
      { s1: summary(1, { blank: true, displayTitle: '新会话', title: '决策演练一' }) },
      undefined,
    )
    expect(rows[0]?.title).toBe('决策演练一')
  })

  it('reports which conversation is on screen and which is working', () => {
    const rows = threadRows(
      [record('chief', 's1'), record('chief', 's2')],
      { s1: summary(2, { running: true }), s2: summary(1) },
      's2',
    )
    expect(rows.map(row => [row.sessionId, row.running, row.active]))
      .toEqual([['s1', true, false], ['s2', false, true]])
  })

  it('shows the newest few and leaves the rest to the workspace browser', () => {
    const records = Array.from({ length: THREAD_VISIBLE_LIMIT + 3 }, (_, index) =>
      record('chief', `s${index}`))
    const summaries = Object.fromEntries(records.map((item, index) => [item.sessionId, summary(index)]))
    const rows = threadRows(records, summaries, undefined)
    expect(rows).toHaveLength(THREAD_VISIBLE_LIMIT)
    expect(rows[0]?.sessionId).toBe(`s${THREAD_VISIBLE_LIMIT + 2}`)
  })

  it('keeps only the bindings whose Session is still listed', () => {
    const kept = liveThreads([record('chief', 's1'), record('chief', 's2')], new Set(['s2']))
    expect(kept.map(item => item.sessionId)).toEqual(['s2'])
  })
})

describe('capability conversations — the binding store', () => {
  it('starts empty and remembers one capability per conversation', () => {
    const threads = createThreadsService()
    expect(threads.getSnapshot().records).toEqual([])
    threads.bind('chief', 's1')
    threads.bind('chief', 's2')
    threads.bind('brand', 's3')
    expect(threads.of('chief').map(item => item.sessionId)).toEqual(['s1', 's2'])
    expect(threads.of('brand').map(item => item.sessionId)).toEqual(['s3'])
    expect(threads.of('nobody')).toEqual([])
  })

  it('does not duplicate a binding made twice', () => {
    const threads = createThreadsService()
    threads.bind('chief', 's1')
    threads.bind('chief', 's1')
    expect(threads.getSnapshot().records).toHaveLength(1)
  })

  it('moves a conversation that a second capability claims', () => {
    const threads = createThreadsService()
    threads.bind('chief', 's1')
    threads.bind('brand', 's1')
    expect(threads.of('chief')).toEqual([])
    expect(threads.of('brand').map(item => item.sessionId)).toEqual(['s1'])
    expect(threads.getSnapshot().records).toHaveLength(1)
  })

  it('forgets one conversation without touching the Session', () => {
    const threads = createThreadsService()
    threads.bind('chief', 's1')
    threads.bind('chief', 's2')
    threads.forget('s1')
    expect(threads.getSnapshot().records.map(item => item.sessionId)).toEqual(['s2'])
  })

  it('prunes the conversations the Host stopped listing', () => {
    const threads = createThreadsService()
    threads.bind('chief', 's1')
    threads.bind('chief', 's2')
    threads.keep(new Set(['s2']))
    expect(threads.of('chief').map(item => item.sessionId)).toEqual(['s2'])
  })

  it('notifies subscribers on every change, and stops on request', () => {
    const threads = createThreadsService()
    let seen = 0
    const stop = threads.subscribe(() => { seen += 1 })
    threads.bind('chief', 's1')
    threads.forget('s1')
    stop()
    threads.bind('chief', 's2')
    expect(seen).toBe(2)
  })

  it('persists under its own key', () => {
    expect(THREADS_PERSIST_NAME).toBe('dsh.suixing.threads')
    createThreadsService().bind('chief', 's1')
    expect(JSON.parse(localStorage.getItem(THREADS_PERSIST_NAME) ?? '{}'))
      .toMatchObject({ records: [{ capabilityId: 'chief', sessionId: 's1' }] })
  })
})

/** A live observable snapshot, as the Session and Workspace lists are. */
function source<T>(value: T) {
  let current = value
  return {
    getSnapshot: () => current,
    subscribe: () => () => {},
    set: (next: T) => { current = next },
  }
}

/** The session services the launcher resolves, with spies for what it calls. */
function services() {
  const openSession = vi.fn()
  const create = vi.fn(async () => 'session-created')
  const sessions = { list: source({ phase: 'ready', byId: {} }), create } as unknown as ISessions
  const uiWorkspace = { openSession } as unknown as UiWorkspace
  return { openSession, create, sessions, uiWorkspace }
}

/** A cradle context carrying the services a build actually has. */
function bench(options: { uiWorkspace?: boolean } = {}) {
  const ctx = new Context()
  const parts = services()
  ctx.provide('sessions', parts.sessions)
  if (options.uiWorkspace !== false) ctx.provide('uiWorkspace', parts.uiWorkspace)
  return { ctx, ...parts }
}

/** Collect one binding as the launcher writes it. */
function bindings(threads: ThreadsService) {
  return threads.getSnapshot().records.map(item => [item.capabilityId, item.sessionId])
}

describe('capability conversations — the launcher', () => {
  it('reports itself unavailable when this build has no session services', () => {
    const ctx = new Context()
    expect(threadServices(ctx)).toBeUndefined()
    const threads = createThreadsService()
    const launcher = createThreadLauncher(ctx, threads)
    expect(launcher.available).toBe(false)
    // Inert rather than throwing: the caller falls back to the shell's own
    // new-chat surface, and nothing here reaches a missing service.
    launcher.start('chief')
    launcher.open('s1')
    expect(threads.getSnapshot().records).toEqual([])
  })

  it('creates the conversation outside every workspace, bound and opened', async () => {
    const subject = bench()
    const threads = createThreadsService()
    const launcher = createThreadLauncher(subject.ctx, threads)
    expect(launcher.available).toBe(true)
    launcher.start('chief')
    await vi.waitFor(() => { expect(subject.openSession).toHaveBeenCalled() })
    // Born without a Workspace: the capability's menu is its only home, and
    // the workspace tree never claims it.
    expect(subject.create).toHaveBeenCalledWith({})
    expect(subject.openSession).toHaveBeenCalledWith('session-created')
    // The binding is written before the conversation opens, which is the only
    // moment the caller learns the Session id.
    expect(bindings(threads)).toEqual([['chief', 'session-created']])
  })

  it('reports itself unavailable without the conversation view service', () => {
    const subject = bench({ uiWorkspace: false })
    const threads = createThreadsService()
    const launcher = createThreadLauncher(subject.ctx, threads)
    // Without the view service the launcher declines, and the caller keeps
    // the fallback; the create service alone cannot show a conversation.
    expect(launcher.available).toBe(false)
    launcher.start('chief')
    expect(subject.create).not.toHaveBeenCalled()
  })

  it('shows a conversation already bound to a capability', () => {
    const subject = bench()
    const launcher = createThreadLauncher(subject.ctx, createThreadsService())
    launcher.open('session-7')
    expect(subject.openSession).toHaveBeenCalledWith('session-7')
  })

  it('survives a create that refuses the conversation', async () => {
    const subject = bench()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    subject.create.mockRejectedValueOnce(new Error('offline'))
    createThreadLauncher(subject.ctx, createThreadsService()).start('chief')
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        'suixing: starting a capability conversation failed:', expect.any(Error),
      )
    })
    warn.mockRestore()
  })

  it('hands the brand-new conversation to its capability role', async () => {
    const subject = bench()
    const assign = vi.fn()
    const threads = createThreadsService()
    createThreadLauncher(subject.ctx, threads, { assign } satisfies RolePresets)
      .start('chief')
    await vi.waitFor(() => {
      expect(assign).toHaveBeenCalledWith('chief', 'session-created')
    })
    // The binding — the sidebar's own note — is unchanged by the role.
    expect(bindings(threads)).toEqual([['chief', 'session-created']])
  })

  it('starts a conversation even when the role binder throws', async () => {
    const subject = bench()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const threads = createThreadsService()
    createThreadLauncher(subject.ctx, threads, {
      assign: () => { throw new Error('remote gone') },
    }).start('chief')
    await vi.waitFor(() => {
      expect(subject.openSession).toHaveBeenCalled()
    })
    // Work began; the role is presentation, never a precondition.
    expect(bindings(threads)).toEqual([['chief', 'session-created']])
    warn.mockRestore()
  })
})

describe('capability roles — the preset mapping and binder', () => {
  it('maps a capability that speaks in role to the preset the deployment ships', () => {
    expect(presetFor('chief')).toBe('suixing-chief')
  })

  it('gives every AI-staff agent a role, so the division answers in character', () => {
    for (const id of AGENT_IDS) {
      expect(presetFor(id), id).toMatch(/^suixing-/)
    }
  })

  it('leaves a capability without a role on the default composition', () => {
    expect(presetFor('report')).toBeUndefined()
  })

  it('is absent in a build without the presets remote', () => {
    // The cradle has no `remote` service; touching it must not throw.
    expect(createRolePresets(new Context())).toBeUndefined()
  })

  it('selects the preset for a role capability and skips the rest', () => {
    const select = vi.fn(async () => ({ ok: true as const, value: 'suixing-chief' }))
    const ctx = new Context()
    ctx.provide('remote', { agentPresets: { select } })
    const roles = createRolePresets(ctx)
    expect(roles).toBeDefined()
    // A workflow has no role: the preset surface is the AI-staff agents'.
    roles?.assign('report', 's1')
    expect(select).not.toHaveBeenCalled()
    roles?.assign('chief', 's2')
    expect(select).toHaveBeenCalledWith('s2', 'suixing-chief')
  })

  it('keeps the conversation when the Host refuses the swap', async () => {
    const select = vi.fn(async () => {
      throw new Error('agent-preset/locked')
    })
    const ctx = new Context()
    ctx.provide('remote', { agentPresets: { select } })
    const roles = createRolePresets(ctx)
    expect(() => roles?.assign('chief', 's1')).not.toThrow()
    await vi.waitFor(() => { expect(select).toHaveBeenCalled() })
  })
})
