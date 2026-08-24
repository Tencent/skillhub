# skillhub

[![CI](https://github.com/Tencent/skillhub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Tencent/skillhub/actions/workflows/ci.yml?query=branch%3Amain)
[![npm](https://img.shields.io/npm/v/@tencent/skillhub.svg)](https://www.npmjs.com/package/@tencent/skillhub)
[![Release](https://img.shields.io/github/v/release/Tencent/skillhub?display_name=tag)](https://github.com/Tencent/skillhub/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)

DeepSeek Harness 的 [SkillHub](https://skillhub.cn) 插件。在对话中搜索技能、查看详情并安装到 Harness 可发现的 skills 目录。

最新正式版：[v0.2.9](https://github.com/Tencent/skillhub/releases/tag/v0.2.9) · [npm](https://www.npmjs.com/package/@tencent/skillhub) · [更新日志](CHANGELOG.md)

## 目录

- [功能](#功能)
- [环境要求](#环境要求)
- [安装](#安装)
- [使用](#使用)
- [配置](#配置)
- [数据与网络](#数据与网络)
- [开发](#开发)
- [故障排查](#故障排查)
- [安全](#安全)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

## 功能

- 用公开接口搜索或按分类浏览技能
- 在对话流中展示可点击卡片（名称、分类、下载量、简介）
- 详情页包含概述、版本历史、TRACE 评测；标题栏显示 AI 评分、认证发布者与安全标记
- 通过 zip 下载安装到本机，可指定版本；支持列出与卸载
- 设置页可查看已安装技能，并一键更新到 GitHub 最新 release
- 侧栏底部 **插件广场**：在聊天区打开独立面板，浏览 SkillHub 技能与 DSH 插件
- 界面跟随 Harness 中英文

## 环境要求

- Node.js 22 或更高版本
- pnpm 11（见 `packageManager` 字段）
- DeepSeek Harness Web

## 安装

从 [npm](https://www.npmjs.com/package/@tencent/skillhub) 安装（预构建，不需要 `allowBuilds`）：

```sh
dsh plugin --profile web add @tencent/skillhub
```

本地开发：

```sh
dsh plugin --profile web add /absolute/path/to/skillhub/dsh-plugin
```

安装后重启 `dsh web`，并强制刷新浏览器。`dsh web` 请绑定 `127.0.0.1`，不要监听 `0.0.0.0`。不要用 `github:Tencent/skillhub` 安装：git 源会跑 `prepare`，pnpm 会要求手写 `allowBuilds`。npm 上的无前缀名 `skillhub` 是另一个项目，请用带 scope 的 `@tencent/skillhub`。

## 使用

可以直接对 Agent 说：

> 找个能处理 PDF 的 skill
>
> SkillHub 上搜一下周报
>
> 我装了哪些技能
>
> 把刚才那个卸载掉

搜索完成后对话中会显示可点击卡片；点开详情后再安装。不要让 Agent 打印安装命令或 curl。

### 插件广场

侧栏底部 **插件广场** 在聊天区域打开独立面板（可切换 **插件** / **技能**），不会出现在「对话 / 轨迹」标签里，也不再注入设置页。面板盖在会话列上，关掉后直接回到对话。

点插件的 **安装** 不会立刻执行 `dsh plugin add`，只会把审核安装提示词排入当前任务：Agent 先读 install-plan，核对仓库、commit、清单和权限后再安装。没有打开任务时，安装按钮会提示先开一个 DSH 任务。

对话里的技能搜索 / zip 安装不受影响。

### Agent 工具

| 工具 | 作用 |
| --- | --- |
| `skillhub_search` | 搜索或浏览技能，并展示卡片 |
| `skillhub_install` | 按 slug 安装；可传 `version` |
| `skillhub_list` | 列出已安装技能 |
| `skillhub_uninstall` | 卸载本地技能目录 |

## 配置

打开 **设置 → 插件 → 插件配置 → SkillHub**：

| 项 | 说明 |
| --- | --- |
| API 地址 | 默认 `https://api.skillhub.cn` |
| 安装目录 | 默认 `$DSH_HOME/skills`（通常是 `~/.dsh/skills`） |
| 搜索结果上限 | 每批返回的卡片数量，默认 12 |

标题栏有 **更新** 按钮：会查询 GitHub 最新 release，并用 `dsh plugin add github:Tencent/skillhub#vX.Y.Z` 安装。更新后请重启 `dsh web` 并强制刷新。若当前是本地 `link:` 开发安装，更新会改成 GitHub release 安装。

保存后立即生效。配置写入 Harness 用户目录下的 `skillhub.json`，不会进入 git。

也可通过 `cordis.patch.yml` 设置默认值：

```yaml
- id: skillhub
  config:
    skillsDir: ~/.dsh/skills
    maxResults: 12
```

安装完成后，新对话即可被 `dsh-skill-filesystem` 发现。该目录有文件监视，多数情况无需重启 Harness。

## 数据与网络

插件只请求 SkillHub 公开 HTTP API，并把技能包写到配置的 skills 目录。图标经本机插件服务转发。自定义 API 地址应只指向你信任的服务。

| 用途 | 请求 |
| --- | --- |
| 搜索 / 浏览 | `GET /api/skills` |
| 技能详情 | `GET /api/v1/skills/{slug}` |
| 版本历史 | `GET /api/v1/skills/{slug}/versions` |
| TRACE 评测 | `GET /api/v1/skills/{slug}/evaluation` |
| 内容签名 | `GET /api/v1/open/skills/{slug}/versions/{version}/signature` |
| 安装包 | `GET /api/v1/download?slug={slug}&source=dsh` |
| DSH 插件类目 | `GET /api/v1/plugins/categories` |
| DSH 插件目录 | `GET /api/v1/plugins` |
| 插件安装计划 | `GET /api/v1/plugins/{owner}/{name}/install-plan` |

上游请求有超时；安装会拒绝路径穿越，并要求解压结果含 `SKILL.md`。技能包来自第三方，插件不执行其中的代码。

## 开发

```sh
git clone https://github.com/Tencent/skillhub.git
cd skillhub/dsh-plugin
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

源码在 `src/`，构建输出到 `lib/`。`lib/` 不进版本库，安装或发布时由 `prepare` 生成。

| 文件 | 作用 |
| --- | --- |
| `src/host.ts` | Cordis 入口：工具注册、systemPrompt、settings |
| `src/local-api.ts` | 本机 `/skillhub` HTTP（搜索、安装、广场、详情、更新） |
| `src/client.js` | 搜索卡片、详情弹窗、设置页、插件广场 |
| `src/api.ts` | 搜索与技能卡片映射 |
| `src/plugin-market.ts` | DSH 插件目录查询与审核安装提示词 |
| `src/install.ts` | zip 下载、解压、安装 / 卸载 |
| `src/skill-detail.ts` | 版本历史与 TRACE 评测 |
| `src/unzip.ts` | zip 解压（含 data descriptor） |
| `src/self-update.ts` | 查询并安装 GitHub 最新 release |
| `src/config-store.ts` | 默认值与 `skillhub.json` |

修改 Host（`src/*.ts`）后需要重启 `dsh web`。修改 Client（`src/client.js`）后复制到 `lib/client.js` 并强制刷新即可。

更完整的约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| 页面停在 Loading plugins | 确认 `pnpm build` 成功，重启 `dsh web` 后强制刷新 |
| `cannot get property "locale" without inject@skillhub` | 升级到含此次修复的版本；重启 `dsh web` 并强制刷新 |
| 搜索卡片未出现 | 开新对话，确认 `skillhub_search` 已加载 |
| 安装失败 / `unexpected end of file` | 确认能访问 download 接口；本插件按中央目录解压 zip |
| 装了但 Agent 看不见 | 确认装到 `$DSH_HOME/skills` 或项目 `.dsh/skills`，并新开对话 |
| 找不到插件市场 | 点侧栏底部 **插件广场**；重启 `dsh web` 并强制刷新 |
| 设置里点更新失败 | 确认能访问 `api.github.com`，且 web profile 可执行 `dsh plugin add` |
| pnpm 拒绝 `prepare` | 用 `dsh plugin add @tencent/skillhub`，不要从 git 安装 |

## 安全

安装第三方技能等于在本机落下可被 Agent 读取的文件。请只安装你信任的来源，并留意详情页的安全标记与评测。

漏洞请按 [SECURITY.md](SECURITY.md) 私下报告，不要发公开 Issue。

## 参与贡献

Bug 修复、测试、文档和交互优化都欢迎。提交前请阅读：

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)
- [CHANGELOG.md](CHANGELOG.md)

发布说明见 [Releases](https://github.com/Tencent/skillhub/releases)。

## 许可证

[MIT](LICENSE)

DeepSeek 名称归其各自所有者。本项目与 DeepSeek 没有从属或背书关系。
