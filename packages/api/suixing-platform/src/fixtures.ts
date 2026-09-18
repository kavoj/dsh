/**
 * Recorded platform payloads, sanitized for the repository.
 *
 * Shapes were captured from the SX-002 probe of agent.35sz.top and then
 * reconciled with the platform's own source (`buildingai` @
 * `feature/mv-agent`) during SX-006. Every value is synthetic — no live token,
 * account, e-mail address, or upload URL is stored here (SX plan §9.3 forbids
 * committing platform credentials or live data). Only the field sets matter:
 * they pin what the bridge must keep reading.
 */

/**
 * Envelope-shaped fixtures keyed by `"<METHOD> <path>"`, so the mock answers
 * through the same {@link readEnvelope} path the live transport uses.
 */
export const PLATFORM_FIXTURES: Readonly<Record<string, unknown>> = {
  'POST /api/auth/login': {
    code: 20000,
    message: 'ok',
    data: {
      token: 'fixture-token-not-a-credential',
      expiresAt: '2026-10-18T04:58:55.600Z',
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        userNo: '20260101000000000001',
        username: 'demo-admin',
        nickname: '超级管理员',
        email: 'demo@example.invalid',
        avatar: 'https://example.invalid/static/avatars/2.png',
        status: 1,
        manageStatus: 1,
        isRoot: 1,
        power: 58002,
        totalRechargeAmount: 400,
        role: null,
        permissions: [],
        createdAt: '2026-07-01T01:12:15.719Z',
        updatedAt: '2026-09-16T07:51:46.168Z',
        lastLoginAt: '2026-09-16T07:51:46.168Z',
        source: 0,
      },
    },
    timestamp: 1789707535614,
    path: '/api/auth/login',
  },

  'GET /api/ai-models': {
    code: 20000,
    message: 'ok',
    data: [
      {
        id: '00000000-0000-4000-8000-0000000000a1',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        name: '旗舰对话模型',
        model: 'fixture-flagship',
        modelType: 'chat',
        providerId: '00000000-0000-4000-8000-0000000000b1',
        features: ['vision', 'thinking'],
        maxContext: 131072,
        modelConfig: { temperature: 0.7 },
        isActive: true,
        thinking: true,
        enableThinkingParam: true,
        description: 'Fixture entry; values are synthetic.',
        sortOrder: 1,
        billingRule: 'per-token',
        membershipLevel: 0,
        isBuiltIn: true,
      },
      {
        id: '00000000-0000-4000-8000-0000000000a2',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        name: '视觉模型',
        model: 'fixture-visual',
        modelType: 'visual',
        providerId: '00000000-0000-4000-8000-0000000000b2',
        features: ['image'],
        maxContext: 8192,
        modelConfig: {},
        isActive: true,
        thinking: false,
        enableThinkingParam: false,
        description: 'Fixture entry; values are synthetic.',
        sortOrder: 2,
        billingRule: 'per-image',
        membershipLevel: 0,
        isBuiltIn: true,
      },
    ],
    timestamp: 1789707535700,
    path: '/api/ai-models',
  },

  'GET /api/ai-agents/canmou/team': {
    code: 20000,
    message: 'ok',
    data: {
      enabled: true,
      orchestratorAgentId: '00000000-0000-4000-8000-0000000000c1',
      teamAgentId: '00000000-0000-4000-8000-0000000000c2',
      members: [
        {
          key: 'market',
          kind: 'expert',
          agentId: '00000000-0000-4000-8000-0000000000c3',
          name: '市场分析参谋',
          description: 'Fixture member; values are synthetic.',
          requiredOnRisk: true,
        },
      ],
    },
    timestamp: 1789707535800,
    path: '/api/ai-agents/canmou/team',
  },

  'GET /api/creator-workflow/list/mine': {
    code: 20000,
    message: 'ok',
    data: [
      {
        id: '00000000-0000-4000-8000-0000000000d1',
        platformId: 'platform-demo',
        workflowKey: 'fixture-xhs-batch',
        name: '小红书批量生成',
        description: 'Fixture workflow; values are synthetic.',
        isBuiltIn: true,
        scope: 'personal',
        ownerId: '00000000-0000-4000-8000-000000000001',
        ownerName: 'demo-admin',
        ownerNickname: '超级管理员',
        ownerAvatar: 'https://example.invalid/static/avatars/2.png',
        canEdit: true,
        isOwner: true,
        nodes: [],
        nodeCount: 4,
      },
    ],
    timestamp: 1789707535900,
    path: '/api/creator-workflow/list/mine',
  },

  'GET /api/assets': {
    code: 20000,
    message: 'ok',
    data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
    timestamp: 1789707536000,
    path: '/api/assets',
  },

  'GET /api/ai-conversations': {
    code: 20000,
    message: 'ok',
    data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
    timestamp: 1789707536100,
    path: '/api/ai-conversations',
  },

  'GET /api/ai-datasets/team': {
    code: 20000,
    message: 'ok',
    data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
    timestamp: 1789707536200,
    path: '/api/ai-datasets/team',
  },

  'GET /api/ai-mcp-servers': {
    code: 20000,
    message: 'ok',
    data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
    timestamp: 1789707536300,
    path: '/api/ai-mcp-servers',
  },

  'GET /api/user/storage': {
    code: 20000,
    message: 'ok',
    data: {
      totalStorage: 10737418240,
      usedStorage: 1048576,
      remainingStorage: 10736369664,
      usagePercent: 0.01,
      membershipActive: false,
      baseStorage: 10737418240,
      membershipExtraStorage: 0,
    },
    timestamp: 1789707536400,
    path: '/api/user/storage',
  },

  'GET /api/config/chat': {
    code: 20000,
    message: 'ok',
    data: {
      suggestions: ['写一条产品介绍', '帮我分析这份文档'],
      suggestionsEnabled: true,
      welcomeInfo: { title: '欢迎使用随星问', description: 'Fixture entry; values are synthetic.' },
      attachmentSizeLimit: 20971520,
    },
    timestamp: 1789707536500,
    path: '/api/config/chat',
  },

  'GET /api/user/info': {
    code: 20000,
    message: 'ok',
    data: {
      id: '00000000-0000-4000-8000-000000000001',
      userNo: '20260101000000000001',
      username: 'demo-admin',
      nickname: '超级管理员',
      email: 'demo@example.invalid',
      avatar: 'https://example.invalid/static/avatars/2.png',
      status: 1,
      manageStatus: 1,
      isRoot: 1,
      power: 58002,
      createdAt: '2026-07-01T01:12:15.719Z',
      updatedAt: '2026-09-16T07:51:46.168Z',
      lastLoginAt: '2026-09-16T07:51:46.168Z',
    },
    timestamp: 1789707536600,
    path: '/api/user/info',
  },

  'POST /api/card-key/redeem': {
    code: 20000,
    message: 'ok',
    data: {
      success: true,
      message: '兑换成功',
      type: 'membership',
      levelName: '专业版',
      endTime: '2027-09-18T00:00:00.000Z',
      giftPoints: 1000,
    },
    timestamp: 1789707536700,
    path: '/api/card-key/redeem',
  },
}
