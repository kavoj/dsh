/**
 * `suixing-bridges` namespace: the capability-connection settings page.
 *
 * The copy states the two rungs plainly, because that is the product decision:
 * every capability works here first, and connecting the platform is an upgrade
 * the user opts into per capability — not a precondition for using the app.
 */

/** The namespace this page's copy is registered under. */
export const BRIDGES_NS = 'suixing-bridges'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.title': '随星能力接入',
  'section.hint': '一切接插件：每项能力默认在本机完成；填上平台接口，就改由平台完成。',
  'base.label': '平台基地址',
  'key.label': 'API Key',
  'base.hint': '留空即全部在本机完成。各能力可以单独覆盖接口地址。API Key 以 Bearer 方式随平台调用发送，仅保存在本浏览器。',
  'bulk.label': '批量切换',
  'bulk.local': '全部走本机',
  'bulk.platform': '全部接平台',
  'list.title': '能力接入点',
  'list.summary': '走平台 {count} / {total} 项',
  'bridge.ppt': 'PPT制作',
  'bridge.image': '图片生成',
  'bridge.video': '视频创作',
  'bridge.music': '音乐创作',
  'bridge.agents': 'AI参谋部能力清单',
  'bridge.workflows': '自动化工厂工作流清单',
  'row.local': '本机',
  'row.platform': '平台',
  'row.endpoint.label': '接口地址',
  'row.endpoint.placeholder': '默认 {path}',
  'row.reset': '恢复默认',
  'row.reset.aria': '把“{name}”的接口地址恢复为默认',
  'state.local': '在本机完成，无需任何配置。',
  'state.ready': '接平台：{url}',
  'state.pending': '已选平台，但还没填接口地址。',
  'note.additive': '平台未就绪也不影响使用：本地这一路始终可用；接口地址可在平台接口确认后随时替换。',
} satisfies Record<string, string>

/** The bridges namespace key union. */
export type SuiXingBridgesKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.title': 'SuiXing capability connections',
  'section.hint': 'Everything plugs in: each capability runs on this machine by default; give it a platform endpoint and the platform runs it instead.',
  'base.label': 'Platform origin',
  'key.label': 'API Key',
  'base.hint': 'Leave it empty to keep everything on this machine. A capability can override its own endpoint. The API Key is sent as the Bearer credential of platform calls and stays in this browser only.',
  'bulk.label': 'Switch all',
  'bulk.local': 'All local',
  'bulk.platform': 'All platform',
  'list.title': 'Connection points',
  'list.summary': '{count} of {total} set for the platform',
  'bridge.ppt': 'PPT production',
  'bridge.image': 'Image generation',
  'bridge.video': 'Video creation',
  'bridge.music': 'Music creation',
  'bridge.agents': 'AI staff capability list',
  'bridge.workflows': 'Automation workflow list',
  'row.local': 'Local',
  'row.platform': 'Platform',
  'row.endpoint.label': 'Endpoint',
  'row.endpoint.placeholder': 'default {path}',
  'row.reset': 'Reset',
  'row.reset.aria': 'Reset the endpoint of “{name}” to its default',
  'state.local': 'Runs on this machine; nothing to configure.',
  'state.ready': 'Platform call: {url}',
  'state.pending': 'Platform chosen, but no endpoint address yet.',
  'note.additive': 'A platform that is not ready changes nothing: the local rung always works, and any endpoint can be replaced once the platform API confirms it.',
} satisfies Record<SuiXingBridgesKey, string>
