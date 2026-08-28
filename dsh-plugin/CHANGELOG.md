# Changelog

本文件格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.2.16] - 2026-08-24

### Changed

- 同步最新插件能力到 [Tencent/skillhub](https://github.com/Tencent/skillhub)；npm 包名保持 `@tencent/skillhub`

## [0.2.14] - 2026-08-24

### Added

- 对话内 DSH 插件搜索与卡片直装：新增 Agent 工具 `skillhub_plugin_search` / `skillhub_plugin_install`，聊天流渲染与技能卡片同款风格的插件卡片（已验证 / 已安装徽标、分类与星标、图标代理 + 首字母兜底）
- 插件卡片一键直装：就地显示安装阶段与已处理包数进度条（复用插件广场 install-plan 校验链与串行锁），失败可重试，并发点击提示排队
- 装完出现「请重启 dsh web」横幅并支持一键重启（与插件广场同链路）；卡片「详情」弹窗展示完整描述、仓库链接与 install-plan 安装来源（pinned commit 规格）
- systemPrompt 补充插件搜索 / 安装规则；客户端新增 `plg.*` 中英文案

### Changed

- 开发依赖升级到 TypeScript 7 与 `@types/node` 26；`tsconfig.json` 显式声明 `types: ["node"]`，因为 TS 7 不再自动纳入 `node_modules/@types` 下的全部包
- 卸载任何已安装插件后都提示重启 dsh web（与安装后同一条横幅，文案为「已卸载 … 请重启后完全卸载」）
- 插件广场「已安装」卡片改为紧凑布局：短标题、包名/ slug 副标题、角标「已装」、底栏来源或文件信息
- 插件广场「已安装」点卡片打开详情，去掉卡片上的「详情」按钮；详情页底部提供卸载
- 插件广场「已安装」抽屉的 README 支持 GitHub 常见 HTML（居中标题、徽章图、`<p align>`），仍过滤 script / javascript: 链接
- 插件广场「已安装」抽屉的 README 改为 Markdown 渲染（标题、列表、表格、链接、徽章），不再等宽纯文本预览
- `SKILL.md` frontmatter 支持 YAML `|` / `>` 多行 description，已安装技能卡片不再把 `|` 显示成空白

### Fixed

- 卸载已安装插件时先停掉运行中的 loader 入口，避免删掉文件后浏览器仍去拉 `/plugins/<name>/client.js` 报 `failed to import loader entry`
- 聊天内卡片布局：`.sh-card` 补 `box-sizing:border-box` 与 `min-width:0`、`.sh-tool` 下统一 border-box，修复聊天工具视图（无 `.sh-mkt` 重置）中卡片因 padding/border 溢出网格轨道、相邻卡片相互挤压重叠的问题
- 安装进度区：`.sh-plg-phase` 长下载 URL 允许断行并限 2 行（`word-break:break-all` + line-clamp)，不再溢出卡片右边界
- 聊天内插件搜索「还有吗」分页：`offset` 未按 `pageSize` 对齐时（如已展示 3 张、默认分页 12）不再重复返回整页卡片，`pluginPaging` 补页内 `skip` 切片并据实计算 `offset` / `hasMore`；翻到尽头时回复「没有了」而非「没找到」
- 安装失败 / 超时后 `pluginInstallStatus` 现在返回错误终态（`error` 带拒绝原因），轮询侧可见失败原因；下次安装开始时自动重置

## [0.2.13] - 2026-08-20

### Changed

- 插件广场安装 git 源时，若 pnpm 拦截 `prepare` / 构建脚本，会写入 web profile 的 `dangerouslyAllowAllBuilds: true` 并自动重试，无需手改 `allowBuilds`

## [0.2.12] - 2026-08-20

### Fixed

- 插件广场「立即重启」在 systemd 托管的 `dsh web`（如腾讯云 `deepseek-harness.service`）上改为 `systemctl restart`，不再 SIGTERM 后被 cgroup 一起杀掉且无法拉起

## [0.2.11] - 2026-08-20

### Fixed

- 插件广场「立即重启」允许同源反向代理（腾讯云 HTTPS + 路径前缀），不再要求本机环回且拒绝 `X-Forwarded-For`

## [0.2.10] - 2026-08-20

### Changed

- 插件广场点安装改为宿主直接执行 `dsh plugin add`（先读 install-plan 并校验 pinned github commit），不再把审核提示词发给当前任务
- 安装过程显示 pnpm 进度条；装完出现「立即重启」按钮，可一键重启当前 `dsh web`（仅同源环回请求）
- 插件广场对照 web profile 已装依赖，已安装的插件显示「已安装」且不再提供安装按钮

## [0.2.9] - 2026-08-18

### Changed

- 插件广场结果文案改为「发现 GitHub MIT 开源的共 {n} 个 DeepSeek Harness Plugin」

## [0.2.8] - 2026-08-18

### Fixed

- 插件广场打开时，点击侧栏会话 / 新会话会关掉面板并回到该会话
- 设置页不再显示「DSH 用户级技能根」和「默认装到 ~/.dsh/skills」

## [0.2.7] - 2026-08-18

### Fixed

- `settings.plugin.item` 等 slot 同时带 `id` 和 `key`，兼容 dsh 0.1.0-rc.6（list 要 id）和 rc.7+（keyed 要 key）

## [0.2.6] - 2026-08-18

### Added

- 侧栏底部「插件广场」：在聊天区打开独立面板（盖住会话列，不改宿主 DOM），可切换插件 / 技能，不占用「对话 / 轨迹」标签

### Changed

- 插件市场不再注入设置「插件」分区，只在广场里打开
- 本机 `/skillhub` HTTP 从 `host.ts` 抽到 `local-api.ts`

### Removed

- 设置市场文案、已安装弹窗和宽版市场样式等未再引用的死代码

## [0.2.5] - 2026-08-18

### Added

- 插件市场卡片显示 `avatarUrl` 头像；没有图或加载失败时用插件名首字母

### Changed

- 插件市场「详情」改为打开 GitHub 仓库，不再跳转 SkillHub 插件页
- 插件市场「加载更多」改为通栏次按钮，并显示剩余数量

## [0.2.4] - 2026-08-18

### Fixed

- 客户端 `__ModuleLoader__.load` 的 `id` 改为 `@tencent/skillhub`，与 npm 包名一致，避免 Web 报 loaded without registering

## [0.2.3] - 2026-08-18

### Fixed

- `cordis.patch.yml` 的 `name` 改为 `@tencent/skillhub`，loader 才能从 npm 包 import，不再找不存在的无前缀 `skillhub`

## [0.2.2] - 2026-08-18

### Changed

- 安装改为走 npm 包 `@tencent/skillhub`（`skillhub` 无前缀名已被占用），避免 git 源触发 `allowBuilds`

## [0.2.1] - 2026-08-18

### Changed

- 插件市场改到设置「插件」分区的标签页，不再单独占侧栏一项
- 市场只浏览已验证的 DSH 插件，筛选项改用 `/api/v1/plugins/categories` 的 7 个 Plugin 类目

### Fixed

- 客户端不再在未 inject `locale` 时读取 `ctx.locale`，避免 loader 报 `cannot get property "locale" without inject@skillhub`
- `settings.plugin.item` 按 keyed slot 用 `key` 注册，不再传 `id`，避免 loader 报 `requires options.key`
- Host 登记 `skillhub` settings 命名空间，插件配置页才能分发 SkillHub 卡片

## [0.2.0] - 2026-08-17

### Added

- 设置侧栏「SkillHub 市场」：搜索 / 筛选 SkillHub 收录的 DSH 插件，点「交给 DSH 安装」把审核安装提示词排入当前任务

## [0.1.1] - 2026-08-16

### Added

- 设置页「更新」按钮：安装 GitHub 最新 release，并提示重启 Harness

### Fixed

- API 与图标请求自动继承反向代理的子路径前缀，兼容轻量云等路径代理

## [0.1.0] - 2026-08-16

### Added

- DeepSeek Harness Web 插件：搜索、安装、列出、卸载 SkillHub 技能
- 对话内技能卡片与详情弹窗（概述 / 版本历史 / TRACE 评测）
- zip 安装（兼容 data descriptor / 中央目录）
- 设置页配置 API 地址、安装目录与搜索数量
- 中英文界面跟随 Harness 语言
- http / unzip / 安装安全、配置 overlay、搜索回退与 Host 渲染测试
- CI 核心模块覆盖率门槛，以及独立的打包检查 job
