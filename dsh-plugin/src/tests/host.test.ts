import assert from 'node:assert/strict'
import test from 'node:test'
import { renderInstall, renderList, renderSearch } from '../host.js'
import type { InstalledSkill, SearchResult, SkillCard } from '../types.js'

function card(partial: Partial<SkillCard>): SkillCard {
  return {
    id: '@u/demo',
    slug: 'demo',
    name: 'Demo',
    description: '',
    category: '',
    categoryLabel: '',
    version: '1.0.0',
    downloads: 0,
    stars: 0,
    installs: 0,
    pageUrl: 'https://skillhub.cn/skills/demo',
    ...partial,
  }
}

test('renderSearch asks for a short empty reply', () => {
  const text = renderSearch({
    query: 'pdf',
    sortBy: 'score',
    items: [],
    total: 0,
    offset: 0,
    hasMore: false,
  })
  assert.match(text, /没有找到/)
  assert.match(text, /不要写长文/)
})

test('renderSearch lists cards and forbids restating them', () => {
  const result: SearchResult = {
    query: '周报',
    sortBy: 'downloads',
    items: [card({ name: '周报助手', slug: 'weekly', installed: true })],
    total: 1,
    offset: 0,
    hasMore: true,
  }
  const text = renderSearch(result)
  assert.match(text, /周报助手（已安装）/)
  assert.match(text, /禁止复述给用户/)
  assert.match(text, /offset=1/)
  assert.doesNotMatch(text, /curl/)
})

test('renderInstall does not print install commands', () => {
  const text = renderInstall({
    slug: 'demo',
    name: 'Demo',
    version: '1.0.0',
    path: '/tmp/skills/demo',
    files: 2,
  })
  assert.match(text, /Demo 已安装/)
  assert.match(text, /不要打印安装命令/)
  assert.doesNotMatch(text, /skillhub install|curl/)
})

test('renderList handles empty and versioned skills', () => {
  assert.match(renderList({ items: [], skillsDir: '/tmp/skills' }), /还没有安装技能/)
  const items: InstalledSkill[] = [
    { slug: 'demo', name: 'Demo', description: '', version: '1.2.0', path: '/tmp/skills/demo' },
  ]
  assert.match(renderList({ items, skillsDir: '/tmp/skills' }), /Demo \(demo\) v1\.2\.0/)
})
