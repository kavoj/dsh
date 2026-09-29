/**
 * Per-platform account rules: how many accounts a channel can carry, what each
 * account needs to exist, and which binding methods the platform accepts.
 *
 * The two families behave differently, and that difference drives the whole
 * configuration model:
 *
 * - **国内内容平台**（无开放写接口）走**主体实名制**：一个身份证/手机号通常只能
 *   对应一个账号，所谓"矩阵号"靠的是**多个实名主体**——这正是三十余人的公司
 *   天然具备的条件（每个员工用自己的身份注册）。系统侧只负责为每个账号保存一份
 *   独立的浏览器登录态。
 * - **海外与开放平台**走**应用授权制**：一个开发者应用通过 OAuth 可以绑定多个
 *   账号，多账号是标准形态，绑定数量取决于应用审核级别而非主体数量。
 *
 * `confidence: 'check'` 表示该口径来自通行说法而非当期官方文档：落地前要用真实
 * 主体在平台注册页确认一次。平台规则会变，这张表也要跟着改。
 */

/** How a platform's accounts come into existence. */
export type AccountModel = 'identity-bound' | 'app-scoped' | 'union'

/** One platform's account rules. */
export interface AccountRule {
  /** Which family the rule belongs to. */
  readonly model: AccountModel
  /** Short answer for the detail panel's headline. */
  readonly headline: string
  /** Whether one operator can hold several accounts of this platform. */
  readonly multiAccount: 'single' | 'multi' | 'per-subject' | 'per-app'
  /** Upper bound when the platform states one; null means "platform-defined". */
  readonly max: number | null
  /** What each account needs before it exists. */
  readonly requires: string
  /** Binding methods the platform actually accepts. */
  readonly methods: readonly BindingMethod[]
  /** One-line caution worth reading before adding accounts. */
  readonly caution?: string
  /** Where the number came from. */
  readonly source?: string
  readonly confidence: 'verified' | 'check'
}

/** How an account's login state is obtained. */
export type BindingMethod = 'qr-login' | 'api-key' | 'oauth'

/** Human labels for the binding methods. */
export const BINDING_LABEL: Record<BindingMethod, { title: string; detail: string }> = {
  'qr-login': { title: '扫码登录', detail: '本机浏览器打开平台登录页，你扫码一次；登录态留在该账号专属的浏览器 profile 里，不经过密码字段' },
  'api-key': { title: 'API 密钥', detail: '开放接口渠道用 AppID/Token；配置只写 env: 引用，密钥放环境变量或本机凭证库' },
  'oauth': { title: 'OAuth 授权', detail: '开放平台授权；一个应用可授权多个账号，token 由凭证库托管' },
}

/** Fallback rules by authorization tier when a platform has no entry of its own. */
const AUTOMATION_FALLBACK: AccountRule = {
  model: 'identity-bound',
  headline: '无开放写接口：账号靠实名主体，登录态存本机',
  multiAccount: 'per-subject',
  max: null,
  requires: '平台账号一个（通常绑定手机号；部分平台需实名）',
  methods: ['qr-login'],
  caution: '这类渠道只能靠浏览器自动化，平台改版会失效；矩阵号必须各自独立登录态',
  confidence: 'check',
}

const TIER_FALLBACK: Record<string, AccountRule> = {
  automation: AUTOMATION_FALLBACK,
  enterprise: {
    model: 'identity-bound',
    headline: '需企业/店铺主体：账号数量随主体数量',
    multiAccount: 'per-subject',
    max: null,
    requires: '企业或个体工商户资质，部分需类目资质',
    methods: ['qr-login', 'oauth'],
    caution: '同一主体能开几个号由平台规则决定，开店前先确认',
    confidence: 'check',
  },
  official: {
    model: 'app-scoped',
    headline: '有开放接口：一个应用可绑定多个账号',
    multiAccount: 'per-app',
    max: null,
    requires: '开发者应用 + 账号授权（部分需审核）',
    methods: ['oauth', 'api-key', 'qr-login'],
    confidence: 'verified',
  },
  audit: {
    model: 'app-scoped',
    headline: '需平台审核：审核通过后一个应用可绑定多个账号',
    multiAccount: 'per-app',
    max: null,
    requires: '开发者应用 + App Review / 商务审批',
    methods: ['oauth'],
    caution: '审核周期以周计，排期要预留',
    confidence: 'verified',
  },
  cps: {
    model: 'union',
    headline: '联盟推广位：一个账号可挂多个推广位',
    multiAccount: 'multi',
    max: null,
    requires: '实名注册的联盟账号（个人通常可注册）',
    methods: ['api-key', 'qr-login'],
    caution: '收益按推广位归因，一个账号可服务多条内容线',
    confidence: 'check',
  },
}

/** Platforms whose rules are worth stating precisely. */
export const ACCOUNT_RULES: Record<string, AccountRule> = {
  toutiao: {
    model: 'identity-bound',
    headline: '一证实名一个号；矩阵号 = 多个实名主体',
    multiAccount: 'per-subject',
    max: 1,
    requires: '实名认证（个人身份证 / 企业主体）',
    methods: ['qr-login'],
    caution: '同一实名主体再开号会被限制；矩阵号让每个运营用自己的身份注册，系统为每个号存独立登录态',
    source: '头条创作者帮助中心·注册&实名认证',
    confidence: 'check',
  },
  baijiahao: {
    model: 'identity-bound',
    headline: '个人一证一号；企业主体可申请多个',
    multiAccount: 'per-subject',
    max: null,
    requires: '实名认证；企业主体需营业执照',
    methods: ['api-key', 'qr-login'],
    caution: '官方发布接口按账号授权，密钥用 env: 引用；每日发文数有上限',
    source: '百家号账号注册指南',
    confidence: 'check',
  },
  tieba: {
    model: 'identity-bound',
    headline: '账号=百度账号；发帖范围由「目标吧」决定，不是多账号',
    multiAccount: 'per-subject',
    max: 1,
    requires: '百度账号（手机号注册）',
    methods: ['qr-login'],
    caution: '一个号可以发多个吧——在配置里加 targets 而不是加账号；贴吧重社区规则，先看吧规再发',
    confidence: 'verified',
  },
  'wechat-mp': {
    model: 'identity-bound',
    headline: '一个主体上限 2 个订阅号 + 2 个服务号；个人 1 个订阅号',
    multiAccount: 'per-subject',
    max: 4,
    requires: '主体认证（企业需营业执照；个人仅订阅号）',
    methods: ['api-key', 'oauth'],
    caution: '发布权限与账号认证状态强相关，个人主体可能拿不到发布接口',
    source: '微信公众平台注册规则（当期口径）',
    confidence: 'check',
  },
  xiaohongshu: {
    model: 'identity-bound',
    headline: '个人一号一证；企业主体可运营多号',
    multiAccount: 'per-subject',
    max: null,
    requires: '实名认证；企业号需主体资质',
    methods: ['qr-login'],
    caution: '无面向个人的发布接口，只能自动化；风控最严的一档，必须限速',
    confidence: 'check',
  },
  douyin: {
    model: 'identity-bound',
    headline: '个人一号一证；企业号按营业执照，多号靠多主体',
    multiAccount: 'per-subject',
    max: null,
    requires: '实名认证（个人）/ 营业执照（企业号）',
    methods: ['qr-login', 'oauth'],
    caution: '内容发布接口不对个人开放，企业开发者/服务商才有',
    source: '抖音开放平台·用户类型及权限说明',
    confidence: 'check',
  },
  x: {
    model: 'app-scoped',
    headline: '一个开发者应用可授权多个账号',
    multiAccount: 'per-app',
    max: null,
    requires: 'X 开发者账号（写权限按量付费）',
    methods: ['oauth'],
    caution: '2026-02 起按量付费：含链接帖约 $0.20/条，多账号要算进预算',
    confidence: 'verified',
  },
  youtube: {
    model: 'app-scoped',
    headline: '一个 OAuth 应用可授权多个频道',
    multiAccount: 'per-app',
    max: null,
    requires: 'Google Cloud 项目 + OAuth 同意屏',
    methods: ['oauth'],
    caution: '默认每日 100 次上传配额，配额是项目级共享的，多账号会互相挤',
    confidence: 'verified',
  },
  instagram: {
    model: 'app-scoped',
    headline: '一个 Meta 应用可授权多个 IG 商业号',
    multiAccount: 'per-app',
    max: null,
    requires: 'Meta 应用 + App Review；IG 需商业号并绑定 FB 主页',
    methods: ['oauth'],
    caution: '审核周期数周；发布频率约 50 帖/24h',
    confidence: 'verified',
  },
  linkedin: {
    model: 'app-scoped',
    headline: '一个应用可授权多个公司主页（需管理员权限）',
    multiAccount: 'per-app',
    max: null,
    requires: '企业主页管理员 + 公司审核',
    methods: ['oauth'],
    confidence: 'verified',
  },
}

/**
 * Resolve one platform's account rules.
 * @param id - platform id.
 * @param tier - the platform's authorization tier, used as the fallback.
 * @returns the specific rule when the platform has one, else the tier fallback.
 */
export function accountRuleFor(id: string, tier: string): AccountRule {
  return ACCOUNT_RULES[id] ?? TIER_FALLBACK[tier] ?? AUTOMATION_FALLBACK
}
