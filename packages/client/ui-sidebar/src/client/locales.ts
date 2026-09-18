/** `sidebar` namespace dictionaries for shell controls and global panels. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'session.new': '新会话',
  'session.new.label': '新建会话',
  'toggle.open': '打开侧边栏',
  'toggle.collapse': '收起侧边栏',
  'panels.label': '全局面板',
  'catalog.search': '在本组中搜索',
  'catalog.search.empty': '没有匹配的能力。',
  'catalog.viewAll': '查看全部（{count}）',
  'catalog.loading': '正在读取能力目录…',
  'catalog.empty': '暂无可用能力',
  'catalog.empty.hint': '请联系管理员，或稍后刷新。',
  'catalog.error': '能力目录加载失败',
  'catalog.offline': '能力目录暂不可用，当前显示最近缓存。',
  'catalog.retry': '刷新',
} satisfies Record<string, string>

/** The sidebar namespace key union. */
export type SidebarKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'session.new': 'New Session',
  'session.new.label': 'New session',
  'toggle.open': 'Open sidebar',
  'toggle.collapse': 'Collapse sidebar',
  'panels.label': 'Global panels',
  'catalog.search': 'Search this group',
  'catalog.search.empty': 'No capability matches.',
  'catalog.viewAll': 'View all ({count})',
  'catalog.loading': 'Reading the capability directory…',
  'catalog.empty': 'No capability available yet',
  'catalog.empty.hint': 'Contact your administrator, or refresh later.',
  'catalog.error': 'The capability directory failed to load',
  'catalog.offline': 'The capability directory is unavailable; showing the cached copy.',
  'catalog.retry': 'Refresh',
} satisfies Record<SidebarKey, string>
