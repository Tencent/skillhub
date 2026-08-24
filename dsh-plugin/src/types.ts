export type SortBy = 'score' | 'downloads' | 'stars' | 'installs' | 'updated_at'

export interface FetchOptions {
  timeoutMs: number
  userAgent: string
}

export interface PluginConfig {
  apiBase: string
  webBase: string
  skillsDir: string
  timeoutMs: number
  userAgent: string
  maxResults: number
  sortBy: SortBy
}

export type SecurityStatus = 'benign' | 'scanning' | 'suspicious' | 'malicious'

export interface SecurityReport {
  status: SecurityStatus
  statusText: string
  reportUrl?: string
}

export interface SecurityReports {
  keen?: SecurityReport
  sanbu?: SecurityReport
}

export interface SkillIntegrity {
  signed: boolean
  contentHash?: string
  signature?: string
}

export interface SkillCard {
  id: string
  slug: string
  name: string
  description: string
  category: string
  categoryLabel: string
  version: string
  downloads: number
  stars: number
  installs: number
  iconUrl?: string
  pageUrl: string
  owner?: string
  installed?: boolean
  rating?: number
  verified?: boolean
  publisherName?: string
  security?: SecurityReports
  integrity?: SkillIntegrity
}

export interface SearchResult {
  query: string
  queries?: string[]
  category?: string
  sortBy: SortBy
  items: SkillCard[]
  total: number
  offset: number
  hasMore: boolean
  fallback?: boolean
}

export interface InstalledSkill {
  slug: string
  name: string
  description: string
  version?: string
  path: string
}

export interface InstallResult {
  slug: string
  name: string
  version: string
  path: string
  files: number
}

export interface SkillHubSkillRaw {
  slug?: string
  name?: string
  displayName?: string
  description?: string
  description_zh?: string
  summary?: string
  summary_zh?: string
  category?: string
  downloads?: number
  stars?: number
  installs?: number
  stats?: {
    downloads?: number
    stars?: number
    installs?: number
  }
  version?: string
  iconUrl?: string | null
  ownerName?: string
  publisher?: {
    name?: string
    verified?: boolean
  }
  namespace?: {
    canonicalName?: string
    handle?: string
    publicSlug?: string
  }
  securityReports?: {
    keen?: { status?: string; statusText?: string; reportUrl?: string }
    sanbu?: { status?: string; statusText?: string; reportUrl?: string }
  }
}

export interface SkillHubDetailRaw {
  slug?: string
  skill?: SkillHubSkillRaw
  namespace?: SkillHubSkillRaw['namespace']
  owner?: { handle?: string; displayName?: string }
  publisher?: SkillHubSkillRaw['publisher']
  latestVersion?: { version?: string }
  securityReports?: SkillHubSkillRaw['securityReports']
}

export interface SkillHubListResponse {
  code: number
  message?: string
  data?: {
    skills?: SkillHubSkillRaw[]
    total?: number
  }
}
