/**
 * Contract types for the SuiXing bridge to agent.35sz.top (随星问).
 *
 * Field sets come from the SX-002 live probe, not from the plan's proposed
 * interface draft. Every entity carries an index signature so unknown fields
 * survive the trip: the platform adds fields without versioning, and a
 * consumer must ignore what it does not know rather than fail on it
 * (SX-006 acceptance: unknown fields are forward-compatible).
 */

/** Client terminal kinds the platform accepts on login. */
export type PlatformTerminalType = 1 | 2 | 3 | 4

/** The platform's uniform response envelope. */
export interface PlatformEnvelope<TData> {
  readonly code: number
  readonly message: string
  readonly data: TData
  readonly timestamp: number
  readonly path: string
}

/** HTTP methods the bridge issues. */
export type PlatformMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

/** One transport-level call. */
export interface PlatformRequest {
  readonly method: PlatformMethod
  readonly path: string
  readonly query?: Readonly<Record<string, string | number | undefined>>
  readonly body?: unknown
  readonly token?: string | undefined
}

/**
 * The single seam the real HTTP transport and the mock both implement, so the
 * bridge client is identical against live and simulated platforms
 * (SX-006 acceptance: one client interface for real and mock).
 */
export interface PlatformTransport {
  send(request: PlatformRequest): Promise<unknown>
}

/** A platform user as returned by login. */
export interface PlatformUser {
  readonly id: string
  readonly userNo: string
  readonly username: string
  readonly nickname: string
  readonly email: string
  readonly avatar: string
  readonly status: number
  readonly manageStatus: number
  readonly isRoot: number
  readonly power: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly lastLoginAt: string | null
  readonly [key: string]: unknown
}

/** The login result: a bearer token, its expiry, and the signed-in user. */
export interface PlatformLoginResult {
  readonly token: string
  readonly expiresAt: string
  readonly user: PlatformUser
  readonly [key: string]: unknown
}

/** The paginated list envelope the platform returns for list reads. */
export interface PlatformPage<TItem> {
  readonly items: readonly TItem[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

/** A model the platform can route to. */
export interface PlatformModel {
  readonly id: string
  readonly name: string
  readonly model: string
  readonly modelType: string
  readonly providerId: string
  readonly maxContext: number
  readonly isActive: boolean
  readonly isBuiltIn: boolean
  readonly description: string
  readonly sortOrder: number
  readonly thinking: boolean
  readonly enableThinkingParam: boolean
  readonly createdAt: string
  readonly updatedAt: string
  readonly features: readonly string[]
  readonly [key: string]: unknown
}

/** One member of the AI参谋部 (canmou) team. */
export interface PlatformAgentMember {
  readonly agentId: string
  readonly name: string
  /**
   * Stable member key. Optional because only the authoritative platform source
   * (`common/modules/auth`, `web/services/src/web/canmou.ts`) declares it; the
   * probe captured the field set without it.
   */
  readonly key?: string
  /** Member role in the arbitration chain, as the platform source declares it. */
  readonly kind?: 'orchestrator' | 'expert' | 'assistant'
  /** Whether the member must join when the run is flagged as risky. */
  readonly requiredOnRisk?: boolean
  readonly description?: string
  readonly [key: string]: unknown
}

/** The AI参谋部 team descriptor. */
export interface PlatformCanmouTeam {
  readonly enabled: boolean
  readonly orchestratorAgentId: string | null
  readonly teamAgentId: string | null
  readonly members: readonly PlatformAgentMember[]
  readonly [key: string]: unknown
}

/** One creator workflow the account can run. */
export interface PlatformWorkflow {
  readonly id: string
  readonly platformId: string
  readonly workflowKey: string
  readonly name: string
  readonly description: string
  readonly isBuiltIn: boolean
  readonly scope: string
  readonly ownerId: string | null
  readonly canEdit: boolean
  readonly isOwner: boolean
  readonly nodeCount: number
  readonly [key: string]: unknown
}

/** The account's storage quota. */
export interface PlatformStorageUsage {
  readonly totalStorage: number
  readonly usedStorage: number
  readonly remainingStorage: number
  readonly usagePercent: number
  readonly membershipActive: boolean
  readonly baseStorage: number
  readonly membershipExtraStorage: number
  readonly [key: string]: unknown
}

/** Chat entry configuration (welcome copy, suggestions, attachment limits). */
export interface PlatformChatConfig {
  readonly suggestions: readonly string[]
  readonly suggestionsEnabled: boolean
  readonly welcomeInfo: unknown
  readonly attachmentSizeLimit: number
  readonly [key: string]: unknown
}

/**
 * The outcome of redeeming a card key (`POST /api/card-key/redeem`).
 *
 * This is the SuiXing device-activation entry point: the platform source
 * exposes it as the only front-office activation route, so the earlier
 * `install-by-activation` candidate is not modelled.
 */
export interface PlatformCardKeyRedeemResult {
  readonly success: boolean
  readonly message: string
  /** What the card granted: points, or a membership level. */
  readonly type: 'points' | 'membership'
  readonly points?: number
  readonly giftPoints?: number
  readonly levelName?: string
  readonly endTime?: string
  readonly [key: string]: unknown
}

/** Credentials for the platform's password login. */
export interface PlatformPasswordCredentials {
  readonly username: string
  readonly password: string
  readonly terminal?: PlatformTerminalType
}

/** Pagination the bridge sends on list reads. */
export interface PlatformPageQuery {
  readonly page?: number
  readonly pageSize?: number
}
