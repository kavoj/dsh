/**
 * The flow workspace: the saved pipelines, the create form that turns a brief
 * plus product images into one, and the run view that shows each step's state.
 *
 * Creating a flow is three plain questions — what to say, which channels, which
 * steps — and the channels a flow targets report whether they already have a
 * bound account, so a missing one is fixed here instead of failing at the end.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import {
  accountIdFromLabel, fetchChannelAccounts, fetchFlows, fetchProgress, formatDuration, getView, idFromName, readQrStatus,
  removeChannelAccount, saveChannelAccount, saveFlow, showView, startQrLogin, startRun, subscribeView, uploadAsset,
  type ChannelAccount, type ChannelSummary, type Flow, type FlowStep, type FlowView, type RunProgress,
} from './flows-api.ts'
import css from './FlowsPage.module.css'

/** Tier labels, kept short because they sit on chips. */
const TIER_LABEL: Record<string, string> = {
  official: '官方 API',
  cps: 'CPS 联盟',
  enterprise: '需企业',
  audit: '需审核',
  automation: '仅自动化',
}

/** Read the shared selection. */
function useView(): FlowView {
  const [, force] = useState(0)
  useEffect(() => subscribeView(() => force(value => value + 1)), [])
  return getView()
}

/** A whole-flow card. */
function FlowCard({ flow, onOpen }: { readonly flow: Flow; readonly onOpen: () => void }): ReactNode {
  return (
    <article className={css.card}>
      <button type="button" className={css.cardButton} onClick={onOpen}>
        <span className={css.cardTitle}>{flow.name}</span>
        <span className={css.cardBrief}>{flow.brief === '' ? '（未填写想法）' : flow.brief}</span>
        <span className={css.cardMeta}>
          <span>{flow.targets.length === 0 ? '未选渠道' : flow.targets.join(' · ')}</span>
          <span>{flow.steps.length} 步</span>
          <span>负责人 {flow.owner}</span>
        </span>
      </button>
    </article>
  )
}

/** The three-question create form. */
function CreateFlow({ channels, template, flows }: {
  readonly channels: readonly ChannelSummary[]
  readonly template: readonly FlowStep[]
  readonly flows: readonly Flow[]
}): ReactNode {
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [images, setImages] = useState('')
  const [targets, setTargets] = useState<readonly string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string): void => {
    setTargets(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const missing = useMemo(() => targets
    .map(id => channels.find(channel => channel.id === id))
    .filter((channel): channel is ChannelSummary => channel !== undefined)
    .filter(channel => channel.accounts.filter(account => account.bound === true).length === 0), [targets, channels])

  const submit = async (): Promise<void> => {
    if (name.trim() === '') { setError('请给流程起个名字，例如「头条日常推文」'); return }
    if (targets.length === 0) { setError('请至少选择一个推广渠道'); return }
    setError(null)
    setSaving(true)
    const id = idFromName(name, flows.map(flow => flow.id))
    const result = await saveFlow({
      id,
      name,
      brief,
      images: images.split('\n').map(line => line.trim()).filter(line => line !== ''),
      targets: [...targets],
      steps: [...template],
      mode: 'manual',
    })
    setSaving(false)
    if (result.ok !== true) { setError(result.error ?? '保存失败'); return }
    showView({ kind: 'detail', id })
  }

  return (
    <div className={css.panel}>
      <button type="button" className={css.back} onClick={() => showView({ kind: 'list' })}>← 返回流程列表</button>
      <h1 className={css.h1}>添加流程</h1>
      <p className={css.sub}>一条流程 = 一个想法 + 一批产品图 + 目标渠道 + 一组可复用的步骤。</p>

      <section className={css.block}>
        <h2 className={css.h2}>① 说清要做什么</h2>
        <label className={css.field}>
          <span className={css.label}>流程名称</span>
          <input className={css.input} value={name} placeholder="例如：头条日常推文" onChange={event => setName(event.target.value)} />
        </label>
        <label className={css.field}>
          <span className={css.label}>想法（写清楚给谁看、想推什么）</span>
          <textarea className={css.textarea} rows={4} value={brief} placeholder="例如：给制造业老板讲 AI 数字员工怎么接手投标和客服" onChange={event => setBrief(event.target.value)} />
        </label>
        <label className={css.field}>
          <span className={css.label}>产品图路径（一行一张，可留空）</span>
          <textarea className={css.textarea} rows={2} value={images} placeholder="/Users/…/产品主图.png" onChange={event => setImages(event.target.value)} />
        </label>
      </section>

      <section className={css.block}>
        <h2 className={css.h2}>② 选择要推广的渠道</h2>
        <div className={css.channelGrid}>
          {channels.length === 0 ? <p className={css.muted}>还没有配置任何渠道，先去「渠道」区绑定。</p> : null}
          {channels.map((channel) => {
            const bound = channel.accounts.filter(account => account.bound === true).length
            return (
              <button
                key={channel.id}
                type="button"
                className={targets.includes(channel.id) ? css.channelOn : css.channel}
                onClick={() => toggle(channel.id)}
              >
                <span className={css.channelName}>{channel.name ?? channel.id}</span>
                <span className={css.channelMeta}>
                  <Tag tone="outline">{TIER_LABEL[channel.tier ?? ''] ?? channel.tier ?? '-'}</Tag>
                  <span className={bound === 0 ? css.warn : css.ok}>{bound === 0 ? '未绑定账号' : `已绑定 ${bound} 个`}</span>
                </span>
              </button>
            )
          })}
        </div>
        {missing.length === 0 ? null : (
          <p className={css.caution}>
            ⚠ {missing.map(channel => channel.name ?? channel.id).join('、')} 还没有已绑定的账号。
            可以先保存流程，然后去「渠道」区点该平台 → 添加账号 → 扫码绑定；绑定后回到这里运行即可。
          </p>
        )}
      </section>

      <section className={css.block}>
        <h2 className={css.h2}>③ 确认步骤（默认七步，M1 可自由增减）</h2>
        <ol className={css.steps}>
          {template.map((step, index) => (
            <li key={step.id} className={css.step}>
              <span className={css.stepIndex}>{index + 1}</span>
              <span className={css.stepName}>{step.name}</span>
              <span className={css.stepKind}>
                {step.kind === 'tool' ? '脚本执行' : step.kind === 'agent' ? 'AI 完成' : '人工'}
                {step.gate === 'review' ? ' · 人工验收' : step.gate === 'approval' ? ' · 人工批准' : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {error === null ? null : <p className={css.error}>{error}</p>}
      <div className={css.actions}>
        <button type="button" className={css.primary} disabled={saving} onClick={() => { void submit() }}>
          {saving ? '保存中…' : '保存流程'}
        </button>
      </div>
    </div>
  )
}

/**
 * In-page account setup for one target channel: list what is bound, add an
 * account, and open its login window — so a missing account is fixed here
 * instead of sending the operator to another panel.
 */
function AccountSetup({ channel, onClose }: {
  readonly channel: ChannelSummary
  readonly onClose: () => void
}): ReactNode {
  const [accounts, setAccounts] = useState<readonly ChannelAccount[] | null>(null)
  const [label, setLabel] = useState('')
  const [owner, setOwner] = useState('')
  const [limit, setLimit] = useState(2)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setAccounts(await fetchChannelAccounts(channel.id)) } catch { setAccounts([]) }
  }, [channel.id])
  useEffect(() => { void load() }, [load])

  const add = async (): Promise<void> => {
    if (label.trim() === '') { setNote('请填写账号名称'); return }
    if (owner.trim() === '') { setNote('请填写负责人，出问题时要能找到人'); return }
    setBusy(true)
    const id = accountIdFromLabel(channel.id, label, (accounts ?? []).map(item => item.id))
    const result = await saveChannelAccount(channel.id, channel.name ?? channel.id, { id, label, owner, dailyLimit: limit })
    setBusy(false)
    if (result.ok !== true) { setNote(result.error ?? '保存失败'); return }
    setLabel('')
    setNote('已保存。接着点这个账号的「扫码绑定」，在弹出的窗口里登录一次即可。')
    await load()
  }

  const drop = async (account: ChannelAccount): Promise<void> => {
    setBusy(true)
    const result = await removeChannelAccount(channel.id, account.id)
    setBusy(false)
    if (result.ok !== true) { setNote(result.error ?? '删除失败'); return }
    // Login state stays in the account's own profile directory; only the entry goes.
    setNote(`已删除「${account.label}」的账号记录。本机登录态目录保留，需要时可重新添加。`)
    await load()
  }

  const bind = async (account: ChannelAccount): Promise<void> => {
    setBusy(true)
    const started = await startQrLogin(channel.id, account.id)
    setBusy(false)
    if (started.ok !== true) {
      setNote(started.error ?? (started.reason === 'no-script' ? '本机还没有安装登录脚本' : '无法启动扫码登录'))
      return
    }
    setNote('登录窗口已打开，请在窗口里扫码；完成后这里会自动更新。')
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      try {
        const status = await readQrStatus(channel.id, account.id)
        if (status.bound) { setNote(`「${account.label}」绑定成功，可以推送了。`); await load(); return }
      } catch { /* keep polling until the budget ends */ }
    }
    setNote('等待超时，可以再点一次「扫码绑定」。')
  }

  return (
    <section className={css.block}>
      <div className={css.titleRow}>
        <h2 className={css.h2}>配置「{channel.name ?? channel.id}」的账号</h2>
        <button type="button" className={css.ghost} onClick={onClose}>收起</button>
      </div>
      <ul className={css.steps}>
        {(accounts ?? []).map(account => (
          <li key={account.id} className={css.step}>
            <span className={css.stepName}>{account.label}</span>
            <span className={css.stepKind}>
              {account.bound === true ? '已绑定' : '待绑定'} · 负责人 {account.owner === undefined || account.owner === '' ? '未填' : account.owner}
            </span>
            <button type="button" className={css.ghost} disabled={busy} onClick={() => { void bind(account) }}>
              {account.bound === true ? '重新绑定' : '扫码绑定'}
            </button>
            <button
              type="button"
              className={css.dangerIcon}
              title="删除这个账号"
              aria-label={`删除账号 ${account.label}`}
              disabled={busy}
              onClick={() => { void drop(account) }}
            >
              🗑️
            </button>
          </li>
        ))}
        {accounts !== null && accounts.length === 0
          ? <li className={css.step}><span className={css.stepKind}>这个渠道还没有账号，用下面的表单添加第一个。</span></li>
          : null}
      </ul>
      <div className={css.accountForm}>
        <input className={css.input} placeholder="账号名称，例如：三五数字官方号" value={label} onChange={event => setLabel(event.target.value)} />
        <input className={css.input} placeholder="负责人" value={owner} onChange={event => setOwner(event.target.value)} />
        <input className={css.input} type="number" min={1} max={10} value={limit} onChange={event => setLimit(Number(event.target.value))} title="每日最多发几条" />
        <button type="button" className={css.primary} disabled={busy} onClick={() => { void add() }}>＋ 添加账号</button>
      </div>
      {note === null ? null : <p className={css.notice}>{note}</p>}
    </section>
  )
}

/** One saved flow: its steps, its targets, and the run action. */
function FlowDetail({ flow, channels }: {
  readonly flow: Flow
  readonly channels: readonly ChannelSummary[]
}): ReactNode {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [tab, setTab] = useState<'workflow' | 'progress' | 'preview'>('workflow')
  const [setup, setSetup] = useState<ChannelSummary | null>(null)
  const [picked, setPicked] = useState<Record<string, readonly string[]>>({ ...(flow.accounts ?? {}) })
  const [accountMap, setAccountMap] = useState<Record<string, readonly ChannelAccount[]>>({})
  const [brief, setBrief] = useState(flow.brief)
  const [assets, setAssets] = useState<readonly string[]>(flow.assets ?? [])
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const targetKey = flow.targets.join(',')

  // Progress is derived from the run directory, so polling is the honest way to
  // show it moving without inventing an event stream we do not have yet.
  useEffect(() => {
    if (runId === null) return undefined
    let live = true
    const tick = async (): Promise<void> => {
      const next = await fetchProgress(runId)
      if (live && next !== null) setProgress(next)
    }
    void tick()
    const timer = setInterval(() => { void tick() }, 3000)
    return () => { live = false; clearInterval(timer) }
  }, [runId])

  useEffect(() => {
    let live = true
    void Promise.all(flow.targets.map(async id => [id, await fetchChannelAccounts(id)] as const))
      .then((pairs) => { if (live) setAccountMap(Object.fromEntries(pairs)) })
      .catch(() => { /* the channel service may be absent; the warnings below cover it */ })
    return () => { live = false }
  }, [targetKey])

  const togglePick = (channelId: string, accountId: string): void => {
    setPicked((current) => {
      const list = current[channelId] ?? []
      return { ...current, [channelId]: list.includes(accountId) ? list.filter(item => item !== accountId) : [...list, accountId] }
    })
  }

  const savePicks = async (): Promise<void> => {
    setBusy(true)
    const result = await saveFlow({ id: flow.id, name: flow.name, accounts: picked })
    setBusy(false)
    setSaved(result.ok === true ? '已保存：只有勾选的账号会被推送。' : (result.error ?? '保存失败'))
  }

  const saveContent = async (): Promise<void> => {
    setBusy(true)
    const result = await saveFlow({ id: flow.id, name: flow.name, brief, assets })
    setBusy(false)
    setSaved(result.ok === true ? '已保存内容与素材。' : (result.error ?? '保存失败'))
  }

  const upload = async (files: FileList | null): Promise<void> => {
    if (files === null || files.length === 0) return
    setBusy(true)
    const added: string[] = []
    for (const file of Array.from(files)) {
      const result = await uploadAsset(flow.id, file)
      if (result.ok && typeof result.path === 'string') added.push(result.path)
    }
    const next = [...assets, ...added]
    if (added.length > 0) { setAssets(next); await saveFlow({ id: flow.id, name: flow.name, assets: next }) }
    setBusy(false)
    setSaved(added.length > 0 ? `已上传 ${added.length} 个素材。` : '上传失败，请重试。')
  }

  const removeAsset = async (path: string): Promise<void> => {
    const next = assets.filter(item => item !== path)
    setAssets(next)
    await saveFlow({ id: flow.id, name: flow.name, assets: next })
  }
  const missing = flow.targets
    .map(id => channels.find(channel => channel.id === id))
    .filter((channel): channel is ChannelSummary => channel !== undefined)
    .filter(channel => channel.accounts.filter(account => account.bound === true).length === 0)

  const run = async (): Promise<void> => {
    setRunning(true)
    const started = await startRun(flow.id)
    setRunning(false)
    if (started.ok !== true) { setResult(started.error ?? '启动失败'); return }
    setRunId(started.runId ?? null)
    setProgress(null)
    setResult(started.hotStarted === true
      ? `已开始运行：抓热点已经在跑，运行记录在 ${started.dir}。接下来「选选题」与「写稿」由 AI 在对话里完成，确认后再填草稿。`
      : `已创建运行记录（${started.dir}），但本机还没安装内容流水线脚本，无法自动抓热点。`)
  }

  return (
    <div className={css.panel}>
      <button type="button" className={css.back} onClick={() => showView({ kind: 'list' })}>← 返回流程列表</button>
      <h1 className={css.h1}>{flow.name}</h1>
      <p className={css.sub}>{flow.brief === '' ? '（未填写想法）' : flow.brief}</p>

      <div className={css.tabBar} role="tablist">
        {([['workflow', '工作流程'], ['progress', '进度'], ['preview', '预览']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? css.tabOn : css.tab}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'workflow' ? null : (
        <>
          <section className={css.block}>
            <h2 className={css.h2}>目标渠道</h2>
            <div className={css.channelGrid}>
              {flow.targets.length === 0 ? <p className={css.muted}>未选择渠道</p> : null}
              {flow.targets.map((id) => {
                const channel = channels.find(item => item.id === id)
                const bound = channel?.accounts.filter(account => account.bound === true).length ?? 0
                return (
                  <div key={id} className={css.channel}>
                    <span className={css.channelName}>{channel?.name ?? id}</span>
                    <span className={css.channelMeta}><span className={bound === 0 ? css.warn : css.ok}>{bound === 0 ? '未绑定账号' : `已绑定 ${bound} 个`}</span></span>
                  </div>
                )
              })}
            </div>
            {missing.length === 0 ? null : (
              <div className={css.setupHint}>
                <p className={css.caution}>⚠ 以下渠道还没有已绑定的账号，绑定后才能推送：</p>
                <div className={css.setupButtons}>
                  {missing.map(channel => (
                    <button key={channel.id} type="button" className={css.primary} onClick={() => setSetup(channel)}>
                      ＋ 配置「{channel.name ?? channel.id}」账号
                    </button>
                  ))}
                </div>
              </div>
            )}
            {setup === null ? null : <AccountSetup channel={setup} onClose={() => setSetup(null)} />}
          </section>

          <section className={css.block}>
            <h2 className={css.h2}>推送账号 · 勾选要推送的账号</h2>
            {flow.targets.length === 0 ? <p className={css.muted}>先在流程里选择目标渠道</p> : null}
            {flow.targets.map((id) => {
              const channel = channels.find(item => item.id === id)
              const list = accountMap[id] ?? []
              return (
                <div key={id} className={css.pickGroup}>
                  <span className={css.pickChannel}>{channel?.name ?? id}</span>
                  {list.length === 0
                    ? <span className={css.warn}>该渠道还没有账号，先用上面的「配置账号」添加</span>
                    : list.map(account => (
                      <label key={account.id} className={css.pickRow}>
                        <input
                          type="checkbox"
                          checked={(picked[id] ?? []).includes(account.id)}
                          onChange={() => togglePick(id, account.id)}
                        />
                        <span className={css.pickName}>{account.label}</span>
                        <span className={account.bound === true ? css.ok : css.warn}>{account.bound === true ? '已绑定' : '待绑定'}</span>
                      </label>
                    ))}
                </div>
              )
            })}
            <div className={css.actions}>
              <button type="button" className={css.primary} disabled={busy} onClick={() => { void savePicks() }}>保存账号选择</button>
            </div>
          </section>


          <section className={css.block}>
            <h2 className={css.h2}>步骤</h2>
            <ol className={css.steps}>
              {flow.steps.map((step, index) => (
                <li key={step.id} className={css.step}>
                  <span className={css.stepIndex}>{index + 1}</span>
                  <span className={css.stepName}>{step.name}</span>
                  <span className={css.stepKind}>
                    {step.kind === 'tool' ? '脚本执行' : step.kind === 'agent' ? 'AI 完成' : '人工'}
                    {step.gate === 'review' ? ' · 人工验收' : step.gate === 'approval' ? ' · 人工批准' : ''}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {tab !== 'progress' ? null : (
        <section className={css.block}>
          <h2 className={css.h2}>制作进度</h2>
          {progress === null
            ? <p className={css.muted}>还没有运行记录。点下方「开始运行」，这里会显示每步进度、耗时、使用的模型与费用估算。</p>
            : (
              <>
                <div className={css.progressHead}>
                  <span className={css.progressPercent}>{progress.percent}%</span>
                  <span className={css.muted}>已用 {formatDuration(progress.totalMs)}</span>
                </div>
                <div className={css.progressTrack}>
                  <div className={css.progressFill} style={{ width: `${progress.percent}%` }} />
                </div>
                <ol className={css.steps}>
                  {progress.steps.map((step, index) => (
                    <li key={step.id} className={css.step}>
                      <span className={css.stepIndex}>{index + 1}</span>
                      <span className={css.stepName}>{step.name}</span>
                      <span className={css.stepKind}>
                        {step.state === 'done' ? `已完成 · ${formatDuration(step.elapsedMs)}` : '待运行'}
                        {step.model === undefined ? '' : ` · ${step.model}`}
                        {step.promptTokens === undefined ? '' : ` · ${step.promptTokens}+${step.completionTokens ?? 0} tok`}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className={css.source}>
                  合计 {formatDuration(progress.totalMs)} · 输入 {progress.promptTokens} tok / 输出 {progress.completionTokens} tok
                  {progress.costCny === undefined
                    ? ' · 费用待记录模型与 token 后估算'
                    : ` · 约 ¥${progress.costCny.toFixed(2)}（按单价 × token 估算，非账单）`}
                </p>
              </>
            )}
        </section>
      )}

      {tab !== 'preview' ? null : (
        <section className={css.block}>
          <h2 className={css.h2}>预览与发布</h2>
          <p className={css.muted}>运行完成后，这里显示封面、正文与配图的成品预览，并提供「存入草稿箱」与「直接发布（需二次确认）」两个按钮。</p>
        </section>
      )}

      {/* The composer keeps its place at the bottom of the panel while the
          views above it scroll. */}
      <section className={`${css.block} ${css.composer}`}>
        <h2 className={css.h2}>内容与素材 · 这次要推什么</h2>
        <textarea
          className={css.textarea}
          rows={4}
          value={brief}
          placeholder="写清楚给谁看、想说什么，例如：给制造业老板讲 AI 数字员工怎么接手投标和客服"
          onChange={event => setBrief(event.target.value)}
        />
        <div className={css.assetRow}>
          <input type="file" multiple onChange={(event) => { void upload(event.target.files) }} />
          <span className={css.muted}>可添加图片 / 视频 / 文件，作为这次推送的主题素材</span>
        </div>
        {assets.length === 0 ? null : (
          <ul className={css.assetList}>
            {assets.map(path => (
              <li key={path} className={css.assetItem}>
                <span className={css.assetName}>{path.split('/').pop()}</span>
                <button type="button" className={css.dangerIcon} title="移除这个素材" onClick={() => { void removeAsset(path) }}>🗑️</button>
              </li>
            ))}
          </ul>
        )}
        <div className={css.actions}>
          <button type="button" className={css.primary} disabled={busy} onClick={() => { void saveContent() }}>保存内容与素材</button>
        </div>
      </section>
      {result === null ? null : <p className={css.notice}>{result}</p>}
      {saved === null ? null : <p className={css.notice}>{saved}</p>}
      <div className={css.actions}>
        <button type="button" className={css.primary} disabled={running} onClick={() => { void run() }}>
          {running ? '启动中…' : '开始运行'}
        </button>
        <button
          type="button"
          className={css.ghost}
          onClick={() => { void saveFlow({ id: flow.id }, 'delete').then(() => showView({ kind: 'list' })) }}
        >
          删除流程
        </button>
      </div>
    </div>
  )
}

/**
 * Render the flow workspace.
 * @returns the panel.
 */
export function FlowsPage(): ReactNode {
  const view = useView()
  const [flows, setFlows] = useState<readonly Flow[] | null>(null)
  const [channels, setChannels] = useState<readonly ChannelSummary[]>([])
  const [template, setTemplate] = useState<readonly FlowStep[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const load = (): void => {
      void fetchFlows().then((status) => {
        if (!live) return
        setFlows(status.flows)
        setChannels(status.channels)
        setTemplate(status.template)
        setError(null)
      }).catch((cause: unknown) => {
        if (!live) return
        setFlows([])
        setError(String((cause as Error).message ?? cause))
      })
    }
    load()
    const timer = setInterval(load, 5000)
    return () => { live = false; clearInterval(timer) }
  }, [])

  if (error !== null) {
    return <div className={css.panel}><h1 className={css.h1}>流程</h1><p className={css.caution}>⚠ 连接不上流程服务（{error}）。请确认宿主已随最新插件启动。</p></div>
  }
  if (view.kind === 'create') return <CreateFlow channels={channels} template={template} flows={flows ?? []} />
  if (view.kind === 'detail') {
    const flow = (flows ?? []).find(item => item.id === view.id)
    if (flow === undefined) return <div className={css.panel}><p className={css.muted}>找不到这个流程。</p></div>
    return <FlowDetail flow={flow} channels={channels} />
  }

  return (
    <div className={css.panel}>
      <div className={css.titleRow}>
        <div>
          <h1 className={css.h1}>流程</h1>
          <p className={css.sub}>把「一个想法 + 产品图」变成各渠道可用的推广素材，并写入已配置的渠道账号。</p>
        </div>
        <button type="button" className={css.primary} onClick={() => showView({ kind: 'create' })}>＋ 添加流程</button>
      </div>
      {flows === null ? <p className={css.muted}>正在读取流程…</p> : null}
      {flows !== null && flows.length === 0
        ? (
          <div className={css.empty}>
            <p className={css.emptyTitle}>还没有流程</p>
            <p className={css.emptyHint}>一条流程可以反复使用：写清想法、选好渠道、确认步骤，之后每次运行只换素材。</p>
            <button type="button" className={css.primary} onClick={() => showView({ kind: 'create' })}>＋ 添加第一条流程</button>
          </div>
        )
        : null}
      <div className={css.cards}>
        {(flows ?? []).map(flow => (
          <FlowCard key={flow.id} flow={flow} onOpen={() => showView({ kind: 'detail', id: flow.id })} />
        ))}
      </div>
    </div>
  )
}
