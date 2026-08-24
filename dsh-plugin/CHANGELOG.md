# Changelog

本文件格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Changed

- 开源仓库迁到 [Tencent/skillhub](https://github.com/Tencent/skillhub)，npm 包名为 `@tencent/skillhub`

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
