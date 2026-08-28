#!/usr/bin/env node
/**
 * SkillHub 公开 API 最小示例：列表 / 详情 / 批量详情
 *
 * 用法：
 *   node docs/examples/node/list-skills.mjs
 *
 * 环境变量：
 *   SKILLHUB_BASE_URL  接口地址，默认 https://api.skillhub.cn
 *   SKILLHUB_API_KEY   团队标识 Key（可选）
 *
 * 依赖：Node.js 18+（使用内置 fetch）
 */

const BASE_URL = process.env.SKILLHUB_BASE_URL ?? 'https://api.skillhub.cn';
const API_KEY = process.env.SKILLHUB_API_KEY;
const DEMO_SLUG = 'find-skill-skillhub';

async function request(path, init = {}) {
  const headers = { Accept: 'application/json', ...init.headers };
  if (API_KEY) headers['X-API-Key'] = API_KEY;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error ?? '';
    } catch {
      // 错误响应不是 JSON 时忽略，用状态码报错即可
    }
    throw new Error(`${path} 请求失败：${res.status}${detail ? ` ${detail}` : ''}`);
  }
  return res.json();
}

/** 列表接口带一层 code/message/data 信封 */
async function listSkills({ pageSize = 5, sortBy = 'downloads', order = 'desc' } = {}) {
  const query = new URLSearchParams({ pageSize: String(pageSize), sortBy, order });
  const body = await request(`/api/skills?${query}`);
  return body.data;
}

async function getSkill(slug) {
  return request(`/api/v1/skills/${encodeURIComponent(slug)}`);
}

async function batchGetSkills(slugs) {
  return request('/api/v1/skills/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slugs }),
  });
}

function printSkills(skills) {
  for (const s of skills) {
    console.log(`  ${s.slug.padEnd(32)} 下载 ${String(s.downloads).padStart(7)}  ${s.name}`);
  }
}

async function main() {
  console.log(`\n=== 下载量 Top 5（${BASE_URL}）===`);
  const { total, skills } = await listSkills();
  console.log(`公开 Skill 总数：${total}`);
  printSkills(skills);

  console.log(`\n=== 详情：${DEMO_SLUG} ===`);
  const { skill, latestVersion, owner } = await getSkill(DEMO_SLUG);
  console.log(`  名称：${skill.displayName}`);
  console.log(`  分类：${skill.category}`);
  console.log(`  最新版本：${latestVersion?.version ?? '-'}`);
  console.log(`  作者：${owner?.handle ?? '-'}`);
  console.log(`  统计：下载 ${skill.stats.downloads} / 收藏 ${skill.stats.stars} / 安装 ${skill.stats.installs}`);

  console.log('\n=== 批量详情（含一个不存在的 slug）===');
  const { items, missing } = await batchGetSkills([DEMO_SLUG, 'not-exist-skill']);
  for (const item of items ?? []) {
    console.log(`  命中：${item.skill.slug} — ${item.skill.displayName}`);
  }
  console.log(`  未命中：${(missing ?? []).join(', ') || '无'}`);

  console.log('\n完成。更多接口见 docs/api/README.md');
}

main().catch((err) => {
  console.error(`\n出错了：${err.message}`);
  process.exit(1);
});
