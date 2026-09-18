/**
 * SX-006 contract tests.
 *
 * They pin the three acceptance points: the live transport and the mock run
 * through one client interface, unknown fields survive the trip, and a failure
 * is locatable from the error it throws. Coverage is per-file 100%, so every
 * branch of the bridge is exercised here.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_TERMINAL,
  PLATFORM_FIXTURES,
  PLATFORM_SUCCESS_CODE,
  SuixingPlatformError,
  buildPlatformUrl,
  createHttpTransport,
  createMockTransport,
  createSuixingPlatformClient,
  isPlatformEnvelope,
  isPlatformError,
  mockFixtureKey,
  platformErrorKind,
  readEnvelope,
} from '../src/index.ts'

/** A minimum Response stand-in: the transport only reads `status` and `text()`. */
function stubResponse(status: number, body: string): Response {
  return { status, text: async (): Promise<string> => body } as unknown as Response
}

/** A Response whose body is the given payload as JSON. */
function jsonResponse(status: number, payload: unknown): Response {
  return stubResponse(status, JSON.stringify(payload))
}

describe('platformErrorKind', () => {
  it('classifies an observed code', () => {
    expect(platformErrorKind(40200)).toBe('unauthenticated')
    expect(platformErrorKind(40000)).toBe('invalid-request')
    expect(platformErrorKind(40300)).toBe('forbidden')
    expect(platformErrorKind(40400)).toBe('not-found')
    expect(platformErrorKind(40900)).toBe('conflict')
    expect(platformErrorKind(42900)).toBe('rate-limited')
    expect(platformErrorKind(50000)).toBe('server-error')
    expect(platformErrorKind(40100)).toBe('unauthenticated')
  })

  it('degrades an unmapped code to unknown instead of throwing', () => {
    expect(platformErrorKind(12345)).toBe('unknown')
  })
})

describe('SuixingPlatformError', () => {
  it('carries code, kind, path, and HTTP status for locating the failure', () => {
    const error = new SuixingPlatformError({
      code: 40200,
      message: 'Please login first',
      path: '/api/ai-models',
      httpStatus: 401,
    })
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('SuixingPlatformError')
    expect(error.code).toBe(40200)
    expect(error.kind).toBe('unauthenticated')
    expect(error.path).toBe('/api/ai-models')
    expect(error.httpStatus).toBe(401)
    expect(error.message).toBe('platform 40200 Please login first (/api/ai-models)')
  })

  it('is recognised by isPlatformError and nothing else is', () => {
    const error = new SuixingPlatformError({ code: 50000, message: 'boom', path: '/x', httpStatus: 500 })
    expect(isPlatformError(error)).toBe(true)
    expect(isPlatformError(new Error('plain'))).toBe(false)
    expect(isPlatformError({ code: 50000 })).toBe(false)
  })
})

describe('isPlatformEnvelope', () => {
  it('accepts only an object with a numeric code', () => {
    expect(isPlatformEnvelope({ code: 20000 })).toBe(true)
    expect(isPlatformEnvelope(null)).toBe(false)
    expect(isPlatformEnvelope('20000')).toBe(false)
    expect(isPlatformEnvelope({ code: '20000' })).toBe(false)
  })
})

describe('readEnvelope', () => {
  it('returns data for the success code', () => {
    const data = { hello: 'world' }
    expect(readEnvelope({ code: PLATFORM_SUCCESS_CODE, message: 'ok', data }, '/p', 200)).toBe(data)
  })

  it('throws a located failure for a business error', () => {
    const call = (): unknown => readEnvelope(
      { code: 40200, message: 'Please login first', data: null },
      '/api/ai-models',
      401,
    )
    expect(call).toThrowError(SuixingPlatformError)
    try {
      call()
    } catch (error) {
      expect(isPlatformError(error)).toBe(true)
      const platform = error as SuixingPlatformError
      expect(platform.code).toBe(40200)
      expect(platform.kind).toBe('unauthenticated')
      expect(platform.httpStatus).toBe(401)
    }
  })

  it('falls back to a placeholder message when the platform sends none', () => {
    try {
      readEnvelope({ code: 50000, data: null }, '/p', 500)
      expect.unreachable('expected a failure')
    } catch (error) {
      expect((error as SuixingPlatformError).message).toBe('platform 50000 the platform returned no message (/p)')
    }
  })

  it('treats a non-envelope payload as a located failure', () => {
    try {
      readEnvelope(undefined, '/api/ai-models', 200)
      expect.unreachable('expected a failure')
    } catch (error) {
      const platform = error as SuixingPlatformError
      expect(platform.code).toBe(0)
      expect(platform.kind).toBe('unknown')
      expect(platform.message).toContain('without a numeric code')
    }
  })
})

describe('buildPlatformUrl', () => {
  const request = { method: 'GET' as const, path: '/api/ai-models' }

  it('joins origin and path with or without a trailing slash', () => {
    expect(buildPlatformUrl('https://agent.35sz.top', request)).toBe('https://agent.35sz.top/api/ai-models')
    expect(buildPlatformUrl('https://agent.35sz.top/', request)).toBe('https://agent.35sz.top/api/ai-models')
  })

  it('omits an absent query and drops unset keys', () => {
    expect(buildPlatformUrl('https://x', request)).toBe('https://x/api/ai-models')
    expect(buildPlatformUrl('https://x', { ...request, query: {} })).toBe('https://x/api/ai-models')
    expect(buildPlatformUrl('https://x', { ...request, query: { page: undefined } })).toBe('https://x/api/ai-models')
  })

  it('serialises the keys the caller set', () => {
    expect(buildPlatformUrl('https://x', { ...request, query: { page: 1, pageSize: 20 } }))
      .toBe('https://x/api/ai-models?page=1&pageSize=20')
  })
})

describe('createHttpTransport', () => {
  it('sends the bearer header and JSON body only when the caller supplies them', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const transport = createHttpTransport({
      baseUrl: 'https://agent.35sz.top',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init as RequestInit })
        return jsonResponse(200, { code: PLATFORM_SUCCESS_CODE, message: 'ok', data: { done: true } })
      },
    })

    const data = await transport.send({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'demo-admin', password: 'x', terminal: 1 },
      token: 'tok',
    })

    expect(data).toEqual({ done: true })
    expect(calls[0]?.url).toBe('https://agent.35sz.top/api/auth/login')
    const headers = calls[0]?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok')
    expect(calls[0]?.init.body).toBe('{"username":"demo-admin","password":"x","terminal":1}')
  })

  it('sends neither header nor body for an anonymous GET', async () => {
    const calls: RequestInit[] = []
    const transport = createHttpTransport({
      baseUrl: 'https://agent.35sz.top',
      fetchImpl: async (_url, init) => {
        calls.push(init as RequestInit)
        return jsonResponse(200, { code: PLATFORM_SUCCESS_CODE, message: 'ok', data: [] })
      },
    })

    await transport.send({ method: 'GET', path: '/api/ai-models' })

    const headers = calls[0]?.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(calls[0]?.body).toBeUndefined()
  })

  it('omits the header for an empty token', async () => {
    let seen: RequestInit | undefined
    const transport = createHttpTransport({
      baseUrl: 'https://x',
      fetchImpl: async (_url, init) => {
        seen = init as RequestInit
        return jsonResponse(200, { code: PLATFORM_SUCCESS_CODE, message: 'ok', data: null })
      },
    })

    await transport.send({ method: 'GET', path: '/api/ai-models', token: '' })

    expect((seen?.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('raises a located failure for an authenticated 401 envelope', async () => {
    const transport = createHttpTransport({
      baseUrl: 'https://x',
      fetchImpl: async () => jsonResponse(401, { code: 40200, message: 'Please login first', data: null }),
    })

    try {
      await transport.send({ method: 'GET', path: '/api/ai-models' })
      expect.unreachable('expected a failure')
    } catch (error) {
      const platform = error as SuixingPlatformError
      expect(platform.code).toBe(40200)
      expect(platform.httpStatus).toBe(401)
      expect(platform.path).toBe('/api/ai-models')
    }
  })

  it('names an SPA fallback as a payload without a code', async () => {
    const transport = createHttpTransport({
      baseUrl: 'https://x',
      fetchImpl: async () => stubResponse(200, '<!doctype html><html></html>'),
    })

    await expect(transport.send({ method: 'GET', path: '/api/home/stats' }))
      .rejects.toThrowError(SuixingPlatformError)
  })

  it('defaults to the global fetch when none is injected', async () => {
    const spy = vi.fn(async () => jsonResponse(200, { code: PLATFORM_SUCCESS_CODE, message: 'ok', data: 'live' }))
    vi.stubGlobal('fetch', spy)
    try {
      const transport = createHttpTransport({ baseUrl: 'https://x' })
      await expect(transport.send({ method: 'GET', path: '/api/ai-models' })).resolves.toBe('live')
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('createMockTransport', () => {
  it('answers a recorded call through the shared envelope reader', async () => {
    const transport = createMockTransport()
    const login = await transport.send({ method: 'POST', path: '/api/auth/login' }) as { token: string }
    expect(login.token).toBe('fixture-token-not-a-credential')
  })

  it('mirrors the platform not-found envelope for an unrecorded call', async () => {
    const transport = createMockTransport({ now: (): number => 42 })
    try {
      await transport.send({ method: 'POST', path: '/api/home/stats' })
      expect.unreachable('expected a failure')
    } catch (error) {
      const platform = error as SuixingPlatformError
      expect(platform.code).toBe(40400)
      expect(platform.kind).toBe('not-found')
      expect(platform.httpStatus).toBe(404)
      expect(platform.message).toBe('platform 40400 Cannot POST /api/home/stats (/api/home/stats)')
    }
  })

  it('accepts a caller-supplied fixture table and clock', async () => {
    const transport = createMockTransport({
      fixtures: {
        'GET /api/custom': { code: PLATFORM_SUCCESS_CODE, message: 'ok', data: 7, timestamp: 1, path: '/api/custom' },
      },
      now: (): number => 1,
    })
    await expect(transport.send({ method: 'GET', path: '/api/custom' })).resolves.toBe(7)
    // An unlisted path still consults the caller's table, not the recorded one.
    await expect(transport.send({ method: 'GET', path: '/api/ai-models' })).rejects.toThrowError(SuixingPlatformError)
  })

  it('keys fixtures by method and path', () => {
    expect(mockFixtureKey({ method: 'GET', path: '/api/ai-models' })).toBe('GET /api/ai-models')
  })

  it('defaults its clock when only fixtures are supplied', async () => {
    const transport = createMockTransport({ fixtures: {} })
    await expect(transport.send({ method: 'GET', path: '/api/ai-models' })).rejects.toThrowError(SuixingPlatformError)
  })
})

describe('createSuixingPlatformClient', () => {
  it('defaults the login terminal and passes an explicit one through', async () => {
    const seen: unknown[] = []
    const client = createSuixingPlatformClient({
      send: async (request) => {
        seen.push(request.body)
        return { token: 't', expiresAt: 'e', user: {} }
      },
    })

    await client.login({ username: 'demo-admin', password: 'x' })
    await client.login({ username: 'demo-admin', password: 'x', terminal: 4 })

    expect(seen[0]).toEqual({ username: 'demo-admin', password: 'x', terminal: DEFAULT_TERMINAL })
    expect(seen[1]).toEqual({ username: 'demo-admin', password: 'x', terminal: 4 })
  })

  it('sends only the pagination keys the caller set', async () => {
    const queries: unknown[] = []
    const client = createSuixingPlatformClient({
      send: async (request) => {
        queries.push(request.query)
        return []
      },
    })

    await client.listWorkflows('tok')
    await client.listWorkflows('tok', { page: 2 })
    await client.listWorkflows('tok', { pageSize: 50 })
    await client.listWorkflows('tok', { page: 2, pageSize: 50 })

    expect(queries).toEqual([{}, { page: 2 }, { pageSize: 50 }, { page: 2, pageSize: 50 }])
  })

  it('addresses every typed endpoint with the probed path and method', async () => {
    const requests: { method: string; path: string; token?: string | undefined }[] = []
    const client = createSuixingPlatformClient({
      send: async (request) => {
        requests.push({ method: request.method, path: request.path, token: request.token })
        return { ok: true }
      },
    })

    await client.listModels()
    await client.getCanmouTeam('tok')
    await client.getStorageUsage('tok')
    await client.getChatConfig()
    await client.send({ method: 'GET', path: '/api/anything' })

    expect(requests).toEqual([
      { method: 'GET', path: '/api/ai-models', token: undefined },
      { method: 'GET', path: '/api/ai-agents/canmou/team', token: 'tok' },
      { method: 'GET', path: '/api/user/storage', token: 'tok' },
      { method: 'GET', path: '/api/config/chat', token: undefined },
      { method: 'GET', path: '/api/anything', token: undefined },
    ])
  })

  it('reads the signed-in account so a restored token can be validated', async () => {
    const seen: { method: string; path: string; token?: string | undefined }[] = []
    const client = createSuixingPlatformClient({
      send: async (request) => {
        seen.push({ method: request.method, path: request.path, token: request.token })
        return { id: 'u1', username: 'demo-admin' }
      },
    })

    const user = await client.getUserInfo('tok')

    expect(user.username).toBe('demo-admin')
    expect(seen).toEqual([{ method: 'GET', path: '/api/user/info', token: 'tok' }])
  })

  it('redeems a card key as the keyCode body the platform validates', async () => {
    const bodies: unknown[] = []
    const client = createSuixingPlatformClient({
      send: async (request) => {
        bodies.push({ method: request.method, path: request.path, body: request.body, token: request.token })
        return { success: true, message: '兑换成功', type: 'points', points: 500 }
      },
    })

    const result = await client.redeemCardKey('tok', 'SX-DEMO-KEY')

    expect(result.type).toBe('points')
    expect(bodies).toEqual([
      {
        method: 'POST',
        path: '/api/card-key/redeem',
        body: { keyCode: 'SX-DEMO-KEY' },
        token: 'tok',
      },
    ])
  })
})

describe('live and mock parity', () => {
  it('returns identical results for the same call over either transport', async () => {
    const clientOverMock = createSuixingPlatformClient(createMockTransport())
    const clientOverHttp = createSuixingPlatformClient(createHttpTransport({
      baseUrl: 'https://agent.35sz.top',
      fetchImpl: async (url) => {
        const path = new URL(String(url)).pathname
        return jsonResponse(200, PLATFORM_FIXTURES[`GET ${path}`])
      },
    }))

    await expect(clientOverHttp.listModels()).resolves.toEqual(await clientOverMock.listModels())
    await expect(clientOverHttp.getCanmouTeam('tok')).resolves.toEqual(await clientOverMock.getCanmouTeam('tok'))
    await expect(clientOverHttp.getChatConfig()).resolves.toEqual(await clientOverMock.getChatConfig())
    await expect(clientOverHttp.getUserInfo('tok')).resolves.toEqual(await clientOverMock.getUserInfo('tok'))
  })

  it('keeps the authoritative canmou member fields the probe did not capture', async () => {
    const team = await createSuixingPlatformClient(createMockTransport()).getCanmouTeam('tok')
    const member = team.members[0]

    expect(member?.key).toBe('market')
    expect(member?.kind).toBe('expert')
    expect(member?.requiredOnRisk).toBe(true)
  })

  it('keeps fields the contract does not declare', async () => {
    const transport = createMockTransport({
      fixtures: {
        'GET /api/ai-models': {
          code: PLATFORM_SUCCESS_CODE,
          message: 'ok',
          data: [{ id: 'm1', name: 'x', model: 'x', modelType: 'chat', providerId: 'p', maxContext: 1,
            isActive: true, isBuiltIn: true, description: '', sortOrder: 1, thinking: false,
            enableThinkingParam: false, createdAt: '', updatedAt: '', features: [],
            brandNewPlatformField: 'kept' }],
          timestamp: 1,
          path: '/api/ai-models',
        },
      },
    })

    const models = await createSuixingPlatformClient(transport).listModels()
    expect((models[0] as Record<string, unknown>).brandNewPlatformField).toBe('kept')
  })
})
