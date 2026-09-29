/**
 * The Channels catalog page. Two views share one panel: the catalog (grouped by
 * role, labelled by authorization availability) and, once a card is picked, that
 * platform's binding detail — the account rules, the binding methods, and an
 * account manager an operator drives with buttons.
 *
 * The account manager reads and writes the team's channel configuration through
 * the plugin's own host routes, so what an operator binds here is exactly what
 * the content pipeline uses later. A QR scan opens a real browser window on this
 * machine; the login state stays in that account's own profile directory.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Input, StateDot, Tag, type TagTone } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import {
  CATEGORIES, PLATFORMS, TIERS,
  type ChannelPlatform, type StatusId, type TierId,
} from './channels-data.ts'
import { accountRuleFor, BINDING_LABEL, type BindingMethod } from './account-rules.ts'
import {
  beginQrBinding, fetchStatus, idFromLabel, readLoginStatus, removeAccount, saveAccount, validateDraft,
  type AccountDraft, type CheckLine, type FieldProblem, type LoginProgress, type TeamAccount,
} from './admin-api.ts'
import css from './ChannelsPage.module.css'

/** How each authorization tier reads on a card. */
const TIER_TONE: Record<TierId, TagTone> = {
  official: 'info',
  cps: 'info',
  enterprise: 'warning',
  audit: 'outline',
  automation: 'danger',
}

/** How each integration state reads on a card. */
const STATUS: Record<StatusId, { readonly label: string; readonly state: 'done' | 'ongoing' | 'warning' | 'idle' }> = {
  live: { label: '已接入', state: 'done' },
  dev: { label: '开发中', state: 'ongoing' },
  review: { label: '审核中', state: 'warning' },
  none: { label: '未接入', state: 'idle' },
}

/** One platform card. */
function ChannelCard({ platform, onOpen }: {
  readonly platform: ChannelPlatform
  readonly onOpen: () => void
}): ReactNode {
  const tier = TIERS.find(item => item.id === platform.tier)
  const status = STATUS[platform.status]
  return (
    <article className={css.card}>
      <button type="button" className={css.cardButton} onClick={onOpen}>
        <span className={css.cardTop}>
          <span className={css.avatar} data-tier={platform.tier}>{platform.name.slice(0, 1)}</span>
          <span className={css.cardName}>{platform.name}</span>
          <span className={css.cardStatus}><StateDot state={status.state} />{status.label}</span>
        </span>
        <span className={css.cardDesc}>{platform.desc}</span>
        <span className={css.cardFoot}>
          <Tag tone={TIER_TONE[platform.tier]}>{tier?.short ?? platform.tier}</Tag>
          {platform.scenes.map(scene => <span key={scene} className={css.scene}>{scene}</span>)}
          <span className={css.cardMore}>账号设置 →</span>
        </span>
      </button>
    </article>
  )
}

/** An empty form state for a new account. */
function blankDraft(): AccountDraft {
  return { id: '', label: '', owner: '', persona: '', dailyLimit: 2, method: 'qr-login' }
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/** The account manager: list, add, bind, health — all in the page. */
function AccountManager({ platform, method }: {
  readonly platform: ChannelPlatform
  readonly method: BindingMethod
}): ReactNode {
  const [accounts, setAccounts] = useState<readonly TeamAccount[] | null>(null)
  const [health, setHealth] = useState<readonly CheckLine[]>([])
  const [configPath, setConfigPath] = useState('')
  const [serviceError, setServiceError] = useState<string | null>(null)
  const [form, setForm] = useState<AccountDraft | null>(null)
  const [problems, setProblems] = useState<readonly FieldProblem[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [binding, setBinding] = useState<{ id: string; progress: LoginProgress | null } | null>(null)

  const reload = useCallback(async () => {
    try {
      const status = await fetchStatus()
      const channel = status.channels.find(item => item.id === platform.id)
      setAccounts(channel?.accounts ?? [])
      setHealth(status.health)
      setConfigPath(status.path)
      setServiceError(null)
    } catch (error) {
      setAccounts([])
      setServiceError(String((error as Error).message ?? error))
    }
  }, [platform.id])

  useEffect(() => { void reload() }, [reload])

  const problemFor = (field: FieldProblem['field']) => problems.find(item => item.field === field)?.message

  const submit = async () => {
    if (form === null) return
    const problemsNow = validateDraft(form, accounts ?? [])
    setProblems(problemsNow)
    if (problemsNow.length > 0) return
    setBusy(true)
    const result = await saveAccount(platform.id, platform.name, form)
    setBusy(false)
    if (result.ok !== true) { setNotice(result.error ?? '保存失败，请重试'); return }
    setForm(null)
    setNotice(`已保存「${form.label}」。下一步点它的「扫码绑定」完成登录，之后就能用它出稿。`)
    await reload()
  }

  const remove = async (account: TeamAccount) => {
    setBusy(true)
    const result = await removeAccount(platform.id, account.id)
    setBusy(false)
    if (result.ok !== true) { setNotice(result.error ?? '移除失败'); return }
    setNotice('已移除该账号。它在本机的登录态目录保留着，需要时重新添加即可复用。')
    await reload()
  }

  const runBind = async (account: TeamAccount) => {
    setBusy(true)
    setNotice(null)
    const started = await beginQrBinding(platform.id, account.id)
    setBusy(false)
    if (started.ok !== true) {
      setNotice(started.reason === 'no-script'
        ? '本机还没有安装登录脚本，无法拉起扫码窗口。'
        : started.error ?? '无法启动扫码登录，请重试。')
      return
    }
    setBinding({ id: account.id, progress: { state: 'starting', note: '正在打开登录窗口…' } })
    setNotice('登录窗口已打开，请在窗口里扫码。完成后这里会自动更新。')
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await sleep(3000)
      try {
        const status = await readLoginStatus(platform.id, account.id)
        setBinding({ id: account.id, progress: status.progress })
        if (status.bound) {
          setBinding(null)
          setNotice(`「${account.label}」扫码成功，登录态已保存在本机。以后出稿会直接使用它。`)
          await reload()
          return
        }
        if (status.progress?.state === 'timeout' || status.progress?.state === 'failed') {
          setBinding(null)
          setNotice(`「${account.label}」没有完成登录：${status.progress.note ?? '请重试'}。`)
          return
        }
      } catch {
        /* a transient poll failure keeps the loop going until the attempt budget ends */
      }
    }
    setBinding(null)
    setNotice('等待超时。可以再点一次「扫码绑定」重来。')
  }

  return (
    <>
      <section className={css.section}>
        <div className={css.sectionHead}>
          <h2>④ 已绑定账号（{accounts?.length ?? 0}）</h2>
          <div className={css.sectionActions}>
            <button type="button" className={css.ghost} onClick={() => { void reload() }}>刷新</button>
            <button
              type="button"
              className={css.primary}
              disabled={busy || serviceError !== null}
              onClick={() => { setForm(blankDraft()); setProblems([]); setNotice(null) }}
            >
              ＋ 添加账号
            </button>
          </div>
        </div>

        {serviceError === null ? null : (
          <p className={css.caution}>
            ⚠ 连接不上本机的渠道服务（{serviceError}）。账号需要它才能读写团队配置与拉起登录窗口；
            请确认宿主已随最新的渠道插件启动。
          </p>
        )}

        {accounts === null && serviceError === null ? <p className={css.source}>正在读取团队配置…</p> : null}

        {accounts !== null && accounts.length === 0 && serviceError === null
          ? (
            <div className={css.emptyState}>
              <p className={css.emptyTitle}>{platform.name}还没有绑定账号</p>
              <p className={css.emptyHint}>
                绑定后，内容流水线才会为这个渠道出稿并填草稿。一个账号一份独立登录态，
                想要多个账号（矩阵号）就再加一个——{platform.name}能开几个号由平台规则决定，见上一节。
              </p>
              <button type="button" className={css.primary} onClick={() => { setForm(blankDraft()); setProblems([]) }}>
                ＋ 绑定第一个账号
              </button>
            </div>
          )
          : null}

        {accounts !== null && accounts.length > 0
          ? (
            <ul className={css.accountList}>
              {accounts.map(account => (
                <li key={account.id} className={css.accountRow}>
                  <span className={css.accountMain}>
                    <span className={css.accountName}>{account.label}</span>
                    <span className={css.accountMeta}>
                      负责人 {account.owner || '未填写'} · 每日上限 {account.dailyLimit ?? '-'} 条 · {account.auth?.kind === 'api-key' ? 'API 密钥' : account.auth?.kind === 'oauth' ? 'OAuth 授权' : '扫码登录'}
                    </span>
                    {account.persona === undefined || account.persona === '' ? null : <span className={css.accountMeta}>用途：{account.persona}</span>}
                    {binding?.id === account.id
                      ? <span className={css.accountMeta}>登录进度：{binding.progress?.note ?? binding.progress?.state ?? '等待中'}</span>
                      : null}
                  </span>
                  <span className={account.bound ? css.pillDone : css.pillTodo}>
                    <StateDot state={account.bound ? 'done' : 'idle'} />{account.bound ? '已绑定' : '待绑定'}
                  </span>
                  <span className={css.accountActions}>
                    <button
                      type="button"
                      className={css.ghost}
                      disabled={busy || binding !== null}
                      onClick={() => { void runBind(account) }}
                    >
                      {account.bound ? '重新绑定' : '扫码绑定'}
                    </button>
                    <button
                      type="button"
                      className={css.ghost}
                      disabled={busy || binding !== null}
                      onClick={() => {
                        setForm({
                          id: account.id,
                          label: account.label,
                          owner: account.owner,
                          persona: account.persona ?? '',
                          dailyLimit: account.dailyLimit ?? 2,
                          method: account.auth?.kind === 'api-key' ? 'api-key' : account.auth?.kind === 'oauth' ? 'oauth' : 'qr-login',
                        })
                        setProblems([])
                      }}
                    >
                      编辑
                    </button>
                    <button type="button" className={css.danger} disabled={busy} onClick={() => { void remove(account) }}>移除</button>
                  </span>
                </li>
              ))}
            </ul>
          )
          : null}

        <div className={css.checkList}>
          {health.map((line, index) => (
            <div key={`${line.text}-${index}`} className={css.checkLine} data-level={line.level}>
              <StateDot state={line.level === 'ok' ? 'done' : line.level === 'error' ? 'error' : 'warning'} />
              <span>{line.text}</span>
            </div>
          ))}
        </div>
        {configPath === '' ? null : <p className={css.source}>团队配置文件：{configPath}</p>}
      </section>

      {form === null ? null : (
        <section className={css.section}>
          <div className={css.sectionHead}>
            <h2>{accounts?.some(item => item.id === form.id) === true ? '编辑账号' : '添加账号'}</h2>
            <div className={css.sectionActions}>
              <button type="button" className={css.ghost} onClick={() => { setForm(null); setProblems([]) }}>取消</button>
              <button type="button" className={css.primary} disabled={busy} onClick={() => { void submit() }}>保存账号</button>
            </div>
          </div>
          <div className={css.formGrid}>
            <label className={css.field}>
              <span className={css.fieldLabel}>账号名称（必填）</span>
              <input
                className={css.input}
                value={form.label}
                placeholder="例如：三五数字官方号"
                onChange={(event) => {
                  const label = event.target.value
                  setForm({ ...form, label, id: idFromLabel(platform.id, label, (accounts ?? []).map(item => item.id)) })
                }}
              />
              {problemFor('label') === undefined ? null : <span className={css.fieldError}>{problemFor('label')}</span>}
            </label>
            <label className={css.field}>
              <span className={css.fieldLabel}>负责人（必填）</span>
              <input
                className={css.input}
                value={form.owner}
                placeholder="谁负责这个号"
                onChange={event => setForm({ ...form, owner: event.target.value })}
              />
              {problemFor('owner') === undefined ? null : <span className={css.fieldError}>{problemFor('owner')}</span>}
            </label>
            <label className={css.field}>
              <span className={css.fieldLabel}>每日最多发几条</span>
              <input
                className={css.input}
                type="number"
                min={1}
                max={10}
                value={form.dailyLimit}
                onChange={event => setForm({ ...form, dailyLimit: Number(event.target.value) })}
              />
              {problemFor('dailyLimit') === undefined ? null : <span className={css.fieldError}>{problemFor('dailyLimit')}</span>}
            </label>
            <label className={css.field}>
              <span className={css.fieldLabel}>这个号怎么说话（选填）</span>
              <input
                className={css.input}
                value={form.persona}
                placeholder="例如：官方口径，讲场景不承诺结果"
                onChange={event => setForm({ ...form, persona: event.target.value })}
              />
            </label>
            <label className={css.field}>
              <span className={css.fieldLabel}>绑定方式</span>
              <select
                className={css.input}
                value={form.method}
                onChange={event => setForm({ ...form, method: event.target.value as BindingMethod })}
              >
                <option value="qr-login">扫码登录（推荐）</option>
                <option value="api-key">API 密钥</option>
                <option value="oauth">OAuth 授权</option>
              </select>
            </label>
          </div>
          <p className={css.source}>
            推荐的绑定方式是 <b>{BINDING_LABEL[method].title}</b>：{BINDING_LABEL[method].detail}
          </p>
        </section>
      )}

      {notice === null ? null : (
        <section className={css.section}>
          <p className={css.notice}>{notice}</p>
          <div className={css.sectionActions}>
            <button type="button" className={css.ghost} onClick={() => setNotice(null)}>知道了</button>
          </div>
        </section>
      )}
    </>
  )
}

/** The binding detail for one platform. */
function ChannelDetail({ platform, onBack }: {
  readonly platform: ChannelPlatform
  readonly onBack: () => void
}): ReactNode {
  const tier = TIERS.find(item => item.id === platform.tier)
  const status = STATUS[platform.status]
  const rule = accountRuleFor(platform.id, platform.tier)
  const primary = rule.methods.includes('qr-login') ? 'qr-login' : rule.methods[0] ?? 'qr-login'
  return (
    <div className={css.detail}>
      <div className={css.detailHead}>
        <button type="button" className={css.back} onClick={onBack}>← 返回渠道列表</button>
        <div className={css.detailTitle}>
          <span className={css.avatar} data-tier={platform.tier}>{platform.name.slice(0, 1)}</span>
          <h1>{platform.name}</h1>
          <Tag tone={TIER_TONE[platform.tier]}>{tier?.short ?? platform.tier}</Tag>
          <span className={css.cardStatus}><StateDot state={status.state} />{status.label}</span>
        </div>
        <p className={css.detailDesc}>{platform.desc}</p>
      </div>

      <section className={css.section}>
        <h2>① 账号规则 · 这个渠道能绑几个</h2>
        <div className={css.ruleGrid}>
          <div className={css.rule}><span className={css.ruleKey}>能否多账号</span><span className={css.ruleValue}>
            {rule.multiAccount === 'per-subject' ? '可以，但受主体数量限制'
              : rule.multiAccount === 'per-app' ? '可以，一个应用可绑多个'
                : rule.multiAccount === 'multi' ? '可以' : '通常一个'}
          </span></div>
          <div className={css.rule}><span className={css.ruleKey}>上限</span><span className={css.ruleValue}>
            {rule.max === null ? '由平台当期规则决定' : `${rule.max} 个`}
          </span></div>
          <div className={css.rule}><span className={css.ruleKey}>每个账号需要</span><span className={css.ruleValue}>{rule.requires}</span></div>
          <div className={css.rule}><span className={css.ruleKey}>口径置信度</span><span className={css.ruleValue}>
            {rule.confidence === 'verified' ? '已核官方文档' : '通行口径，绑定前请用真实主体确认一次'}
          </span></div>
        </div>
        <p className={css.ruleHeadline}>{rule.headline}</p>
        {rule.caution === undefined ? null : <p className={css.caution}>⚠ {rule.caution}</p>}
        {rule.source === undefined ? null : <p className={css.source}>依据：{rule.source}</p>}
        <p className={css.source}>
          国内内容平台是「主体实名制」，矩阵号靠多个实名主体（可让每位运营用自己的身份注册）；海外开放平台是「应用授权制」，一个应用可绑多个账号。
        </p>
      </section>

      <section className={css.section}>
        <h2>② 绑定方式</h2>
        <div className={css.methods}>
          {rule.methods.map((method: BindingMethod) => (
            <div key={method} className={css.method} data-recommended={method === primary}>
              <div className={css.methodTitle}>
                {BINDING_LABEL[method].title}
                {method === primary ? <span className={css.badge}>推荐</span> : null}
              </div>
              <p className={css.methodDetail}>{BINDING_LABEL[method].detail}</p>
            </div>
          ))}
        </div>
        <p className={css.noPassword}>
          <b>本页不收密码。</b>平台密码写进页面或配置文件，等于把多个矩阵号的密码集中到一处：一旦泄露是全量损失，平台风控也普遍直接拦「异地／自动化登录」。扫码登录把登录态留在<b>该账号专属的本机浏览器目录</b>里，团队配置只登记账号本身。
        </p>
      </section>

      <section className={css.section}>
        <h2>③ 工作流与发布策略</h2>
        <div className={css.ruleGrid}>
          <div className={css.rule}>
            <span className={css.ruleKey}>内容流水线</span>
            <span className={css.ruleValue}>抓热点 → 选题 → 写稿 → 封面 → 配图 → 预览 → 填草稿</span>
          </div>
          <div className={css.rule}><span className={css.ruleKey}>发布模式</span><span className={css.ruleValue}>只填草稿，永不自动发布</span></div>
          <div className={css.rule}><span className={css.ruleKey}>人工闸门</span><span className={css.ruleValue}>预览页验收通过后才允许填草稿</span></div>
          <div className={css.rule}><span className={css.ruleKey}>配置位置</span><span className={css.ruleValue}>本机渠道配置（团队共用同一份文件）</span></div>
        </div>
      </section>

      <AccountManager platform={platform} method={primary} />
    </div>
  )
}

/**
 * Render the Channels catalog or one channel's binding detail.
 * @returns the page.
 */
export function ChannelsPage(): ReactNode {
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState<TierId | 'all'>('all')
  const [selected, setSelected] = useState<ChannelPlatform | null>(null)

  const matched = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return PLATFORMS.filter((platform) => {
      if (tier !== 'all' && platform.tier !== tier) return false
      if (needle === '') return true
      const haystack = `${platform.name} ${platform.desc} ${platform.scenes.join(' ')} ${platform.tier}`
      return haystack.toLowerCase().includes(needle)
    })
  }, [query, tier])

  const counts = useMemo(() => {
    const map = new Map<TierId, number>()
    for (const platform of PLATFORMS) map.set(platform.tier, (map.get(platform.tier) ?? 0) + 1)
    return map
  }, [])

  if (selected !== null) {
    return (
      <div className={css.page}>
        <ChannelDetail platform={selected} onBack={() => setSelected(null)} />
      </div>
    )
  }

  return (
    <div className={css.page}>
      <header className={css.head}>
        <h1>渠道</h1>
        <p>{CATEGORIES.length} 大类 · {PLATFORMS.length} 个推广平台 · 点开任意平台即可设置账号</p>
        <Input
          className={css.search ?? ''}
          placeholder="搜索平台、场景或授权方式，例如「百家号」「官方 API」「CPS」「审核」"
          value={query}
          onChange={event => setQuery(event.target.value)}
          aria-label="搜索平台"
        />
        <div className={css.filters}>
          <button type="button" className={tier === 'all' ? css.chipOn : css.chip} onClick={() => setTier('all')}>
            全部 <span className={css.chipCount}>{PLATFORMS.length}</span>
          </button>
          {TIERS.map(item => (
            <button
              key={item.id}
              type="button"
              className={tier === item.id ? css.chipOn : css.chip}
              onClick={() => setTier(item.id)}
            >
              <span className={css.tierDot} data-tier={item.id} />
              {item.short} <span className={css.chipCount}>{counts.get(item.id) ?? 0}</span>
            </button>
          ))}
        </div>
      </header>

      <div className={css.stats}>
        {TIERS.map(item => (
          <div key={item.id} className={css.stat}>
            <span className={css.statKey}><span className={css.tierDot} data-tier={item.id} />{item.short}</span>
            <span className={css.statValue}>{counts.get(item.id) ?? 0}<span className={css.statUnit}>个</span></span>
          </div>
        ))}
      </div>

      <div className={css.body}>
        {CATEGORIES.map((category) => {
          const items = matched.filter(platform => platform.cat === category.id)
          if (items.length === 0) return null
          return (
            <section key={category.id} className={css.category}>
              <div className={css.categoryHead}>
                <h2>{category.id} · {category.name}</h2>
                <span className={css.categoryTag}>{items.length} 个 · {category.role}</span>
                <span className={css.categoryLine} />
              </div>
              <div className={css.cards}>
                {items.map(platform => (
                  <ChannelCard key={platform.id} platform={platform} onOpen={() => setSelected(platform)} />
                ))}
              </div>
            </section>
          )
        })}
        {matched.length === 0 ? <p className={css.empty}>没有匹配的关键词，换个词试试。</p> : null}
      </div>
    </div>
  )
}
