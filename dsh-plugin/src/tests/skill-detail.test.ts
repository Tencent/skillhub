import assert from 'node:assert/strict'
import test from 'node:test'
import { HttpError } from '../http.js'
import { dimScore, fetchEvalScore, fetchSkillTab, overallScore } from '../skill-detail.js'
import { withDefaults } from '../config-store.js'
import type { PluginConfig } from '../types.js'

test('TRACE scores average item scores', () => {
  const dims = {
    trust: { items: { a: { score: 5 }, b: { score: 4 } } },
    reliability: { items: { a: { score: 4 } } },
  }
  assert.equal(dimScore(dims.trust), 4.5)
  assert.equal(overallScore(dims), 4.3)
  assert.equal(dimScore(null), null)
  assert.equal(overallScore(undefined), null)
})

test('fetchSkillTab versions sanitize payload', async () => {
  const versions = await fetchSkillTab('demo', 'versions', testCfg(), {
    fetchJson: async <T>() => ({
      versions: [
        { version: '1.0.2', changelog: 'Initial release', createdAt: 1782461490627 },
        { version: '1.0.1', changelog: 'fix', createdAt: 1 },
      ],
    }) as T,
  })
  assert.equal((versions.versions as Array<{ version: string }>).length, 2)
})

test('fetchEvalScore returns overall TRACE score', async () => {
  const score = await fetchEvalScore('ima-skills', testCfg(), {
    fetchJson: async <T>() => ({
      dimensions: {
        trust: { items: { a: { score: 5 }, b: { score: 4 } } },
        reliability: { items: { a: { score: 4.6 } } },
        adaptability: { items: { a: { score: 4.4 } } },
        convention: { items: { a: { score: 4.5 } } },
        effectiveness: { items: { a: { score: 4.9 } } },
      },
    }) as T,
  })
  assert.equal(score, 4.6)
})

test('fetchEvalScore returns null when missing', async () => {
  const score = await fetchEvalScore('demo', testCfg(), {
    fetchJson: async <T>(): Promise<T> => {
      throw new HttpError('HTTP 404', 404)
    },
  })
  assert.equal(score, null)
})

test('fetchSkillTab evaluation missing becomes null', async () => {
  const result = await fetchSkillTab('demo', 'evaluation', testCfg(), {
    fetchJson: async <T>(): Promise<T> => {
      throw new HttpError('HTTP 404', 404)
    },
  })
  assert.equal(result.evaluation, null)
})

test('fetchSkillTab evaluation sanitizes and truncates text', async () => {
  const result = await fetchSkillTab('demo', 'evaluation', testCfg(), {
    fetchJson: async <T>() => ({
      userSummary: 's'.repeat(2000),
      dimensions: {
        trust: {
          userReason: 'r'.repeat(2000),
          items: { a: { score: 4, userReason: 'i'.repeat(800) } },
        },
      },
    }) as T,
  })
  const ev = result.evaluation as {
    userSummary: string
    score: number
    dimensions: { trust: { userReason: string; items: { a: { userReason: string } } } }
  }
  assert.equal(ev.userSummary.length, 1200)
  assert.equal(ev.dimensions.trust.userReason.length, 1200)
  assert.equal(ev.dimensions.trust.items.a.userReason.length, 400)
  assert.equal(ev.score, 4)
})

test('fetchSkillTab evaluation rethrows non-404 errors', async () => {
  await assert.rejects(
    () => fetchSkillTab('demo', 'evaluation', testCfg(), {
      fetchJson: async <T>(): Promise<T> => {
        throw new HttpError('HTTP 500', 500)
      },
    }),
    /HTTP 500/,
  )
})

test('fetchSkillTab versions cap changelog length', async () => {
  const versions = await fetchSkillTab('demo', 'versions', testCfg(), {
    fetchJson: async <T>() => ({
      versions: [{ version: '2.0.0', changelog: 'c'.repeat(800), createdAt: 'bad' }],
    }) as T,
  })
  const first = (versions.versions as Array<{ changelog: string; createdAt: number }>)[0]
  assert.equal(first.changelog.length, 500)
  assert.equal(first.createdAt, 0)
})

test('fetchSkillTab rejects unknown tab', async () => {
  await assert.rejects(
    () => fetchSkillTab('demo', 'comments', testCfg(), {
      fetchJson: async <T>() => ({}) as T,
    }),
    /未知 tab/,
  )
})

function testCfg(): PluginConfig {
  return withDefaults({ timeoutMs: 5000, userAgent: 'test' })
}
