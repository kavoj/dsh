/**
 * The bridge client — one interface over the live platform and the mock.
 *
 * Typed methods cover the endpoints the SX-002 probe pinned and SX-006 later
 * confirmed against the platform's own source (`buildingai` @
 * `feature/mv-agent`), which enumerates 541 routes across three planes. The
 * SuiXing client consumes only the `/api` plane; {@link
 * SuixingPlatformClient.send} is the escape hatch for everything else until a
 * path earns a typed wrapper with a recorded fixture.
 */

import type {
  PlatformCanmouTeam,
  PlatformCardKeyRedeemResult,
  PlatformChatConfig,
  PlatformLoginResult,
  PlatformModel,
  PlatformPageQuery,
  PlatformPasswordCredentials,
  PlatformRequest,
  PlatformStorageUsage,
  PlatformTerminalType,
  PlatformTransport,
  PlatformUser,
  PlatformWorkflow,
} from './types.ts'

/** The terminal to present when a caller does not name one. */
export const DEFAULT_TERMINAL: PlatformTerminalType = 1

/** The typed facade over a {@link PlatformTransport}. */
export interface SuixingPlatformClient {
  /** Send any platform call and receive its unwrapped `data`. */
  send<TData>(request: PlatformRequest): Promise<TData>
  /** Exchange credentials for a bearer token. */
  login(credentials: PlatformPasswordCredentials): Promise<PlatformLoginResult>
  /** Read the signed-in account, which is how a restored token is validated. */
  getUserInfo(token: string): Promise<PlatformUser>
  /** Redeem a card key, the platform's front-office activation route. */
  redeemCardKey(token: string, keyCode: string): Promise<PlatformCardKeyRedeemResult>
  /** List the models the platform can route to. */
  listModels(): Promise<readonly PlatformModel[]>
  /** Read the AI参谋部 team descriptor. */
  getCanmouTeam(token: string): Promise<PlatformCanmouTeam>
  /** List the creator workflows this account can run. */
  listWorkflows(token: string, query?: PlatformPageQuery): Promise<readonly PlatformWorkflow[]>
  /** Read the account's storage quota. */
  getStorageUsage(token: string): Promise<PlatformStorageUsage>
  /** Read the chat entry configuration. */
  getChatConfig(): Promise<PlatformChatConfig>
}

/**
 * Turn optional pagination into a query record, dropping unset fields so the
 * platform's strict parameter validation never sees an extra property.
 * @param query - the caller's pagination, if any.
 * @returns A query record with only the keys the caller set.
 */
function pageQuery(query: PlatformPageQuery | undefined): Record<string, number> {
  const result: Record<string, number> = {}
  if (query?.page !== undefined) result.page = query.page
  if (query?.pageSize !== undefined) result.pageSize = query.pageSize
  return result
}

/**
 * Create the bridge client over any transport.
 * @param transport - the live transport or the mock.
 * @returns The typed client.
 */
export function createSuixingPlatformClient(transport: PlatformTransport): SuixingPlatformClient {
  const send = async <TData>(request: PlatformRequest): Promise<TData> => {
    return await transport.send(request) as TData
  }
  return {
    send,
    async login(credentials: PlatformPasswordCredentials): Promise<PlatformLoginResult> {
      return await send<PlatformLoginResult>({
        method: 'POST',
        path: '/api/auth/login',
        body: {
          username: credentials.username,
          password: credentials.password,
          terminal: credentials.terminal ?? DEFAULT_TERMINAL,
        },
      })
    },
    async getUserInfo(token: string): Promise<PlatformUser> {
      return await send<PlatformUser>({ method: 'GET', path: '/api/user/info', token })
    },
    async redeemCardKey(token: string, keyCode: string): Promise<PlatformCardKeyRedeemResult> {
      return await send<PlatformCardKeyRedeemResult>({
        method: 'POST',
        path: '/api/card-key/redeem',
        body: { keyCode },
        token,
      })
    },
    async listModels(): Promise<readonly PlatformModel[]> {
      return await send<readonly PlatformModel[]>({ method: 'GET', path: '/api/ai-models' })
    },
    async getCanmouTeam(token: string): Promise<PlatformCanmouTeam> {
      return await send<PlatformCanmouTeam>({ method: 'GET', path: '/api/ai-agents/canmou/team', token })
    },
    async listWorkflows(token: string, query?: PlatformPageQuery): Promise<readonly PlatformWorkflow[]> {
      return await send<readonly PlatformWorkflow[]>({
        method: 'GET',
        path: '/api/creator-workflow/list/mine',
        token,
        query: pageQuery(query),
      })
    },
    async getStorageUsage(token: string): Promise<PlatformStorageUsage> {
      return await send<PlatformStorageUsage>({ method: 'GET', path: '/api/user/storage', token })
    },
    async getChatConfig(): Promise<PlatformChatConfig> {
      return await send<PlatformChatConfig>({ method: 'GET', path: '/api/config/chat' })
    },
  }
}
