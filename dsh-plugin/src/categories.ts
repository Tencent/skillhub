export const CATEGORIES: Record<string, string> = {
  'office-efficiency': '办公效率',
  'content-creation': '内容创作',
  'dev-programming': '开发编程',
  'data-analysis': '数据分析',
  'design-media': '设计多媒体',
  'ai-agent': 'AI Agent',
  'knowledge-management': '知识管理',
  'business-ops': '商业运营',
  education: '教育学习',
  professional: '行业专业',
  'it-ops-security': 'IT 运维与安全',
  'life-service': '生活服务',
}

export const CATEGORY_KEYS = Object.keys(CATEGORIES)

export function categoryLabel(key: string | undefined): string {
  if (!key) return ''
  return CATEGORIES[key] || key
}

export function parseCategory(raw: unknown): string | undefined {
  const key = String(raw || '').trim()
  if (!key) return undefined
  return CATEGORY_KEYS.includes(key) ? key : undefined
}
