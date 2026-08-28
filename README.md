# SkillHub

[中文](#skillhub) | [English](#skillhub-english)

面向 Agent 生态的技能基础设施。本仓库开源两部分：**Open API 文档与调用示例**（[`docs/`](docs/)），以及 **DeepSeek Harness 插件**（[`dsh-plugin/`](dsh-plugin/)）。

开源仓库：[github.com/Tencent/skillhub](https://github.com/Tencent/skillhub) · 产品站点：[skillhub.cn](https://skillhub.cn)

SkillHub 提供 Skill 的发现、安装、发布、评测和运行能力。开发者可以在这里分享 Skill，Agent 和各类应用也可以直接查找和使用这些能力。

目前已收录 **8 万+ Skills**，累计下载 **6000 万+ 次**，**单月下载量超过 2000 万次**，并有 **500+ 商家**入驻。

## 仓库结构

| 目录 | 内容 |
|------|------|
| [`docs/`](docs/) | Open API 文档、接入说明与可运行示例 |
| [`dsh-plugin/`](dsh-plugin/) | DeepSeek Harness 的 SkillHub 插件（npm：`@tencent/skillhub`） |

## Open API

[SkillHub CLI](https://skillhub.cn) 已经支持在终端完成 Skill 的发现、安装、发布与校验。开放 HTTP + JSON 接口，是为了覆盖 CLI 覆盖不到的产品接入场景：在 Agent、IDE、浏览器插件或企业门户中内嵌搜索与安装，搭建自己的技能广场，或在服务端批量同步与治理 Skill。

| 你想做什么 | 可以使用的能力 |
|------------|----------------|
| 在产品中加入 Skill 搜索 | 搜索、分类、榜单、推荐和详情 |
| 展示并安装 Skill | 文件、版本、版本差异和下载 |
| 判断 Skill 是否可靠 | 评测、测试结果、签名和验签 |
| 发布与治理 | 发布、导入、版本、组织内私有 Skill |
| 在 Agent 中运行 | 沙箱、会话、流式输出和文件处理 |

快速开始：

```bash
export SKILLHUB_BASE_URL='https://api.skillhub.cn'

curl "$SKILLHUB_BASE_URL/api/skills?sortBy=downloads&order=desc&pageSize=5"
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub"
```

完整说明、接口总览与字段约定见 [docs/README.md](docs/README.md) 和 [docs/api/README.md](docs/api/README.md)。可运行示例（Shell / Node.js / Python）见 [docs/examples/](docs/examples/)：

```bash
bash docs/examples/curl/quickstart.sh
node docs/examples/node/list-skills.mjs
python3 docs/examples/python/list_skills.py
```

公开 API 可直接按文档接入。访问组织内 Skill 需要相应成员权限。较大调用量、沙箱或模型等高消耗能力，建议上线前按 [docs/apply.md](docs/apply.md) 联系我们。

## DeepSeek Harness 插件

[`dsh-plugin/`](dsh-plugin/) 让你在 DeepSeek Harness 对话里搜索 SkillHub 技能、查看详情，并安装到本机 skills 目录。也支持按分类浏览、版本选择、卸载，以及侧栏「插件广场」。

从 npm 安装（预构建，不需要 `allowBuilds`）：

```sh
dsh plugin --profile web add @tencent/skillhub
```

本地开发：

```sh
dsh plugin --profile web add /absolute/path/to/skillhub/dsh-plugin
```

安装后重启 `dsh web`（请绑定 `127.0.0.1`），并强制刷新浏览器。请使用带 scope 的 `@tencent/skillhub`，不要安装 npm 上的无前缀包 `skillhub`。

功能、配置、开发与故障排查见 [dsh-plugin/README.md](dsh-plugin/README.md)。

## 贡献与问题反馈

```bash
git clone https://github.com/Tencent/skillhub.git
```

- 贡献入口见 [CONTRIBUTING.md](CONTRIBUTING.md)：API 文档走 [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)，插件走 [dsh-plugin/CONTRIBUTING.md](dsh-plugin/CONTRIBUTING.md)
- 使用问题、文档错误、接口或插件行为异常：提交 [GitHub Issue](https://github.com/Tencent/skillhub/issues)
- 安全问题：请勿公开提交 Issue，按 [SECURITY.md](SECURITY.md) 报告

## License

本仓库以 [MIT License](LICENSE) 发布。

联系邮箱：[skillhub@tencent.com](mailto:skillhub@tencent.com)

---

# SkillHub (English)

[中文](#skillhub) | [English](#skillhub-english)

Skill infrastructure for the Agent ecosystem. This repository publishes two things: **Open API docs and runnable examples** ([`docs/`](docs/)), and a **DeepSeek Harness plugin** ([`dsh-plugin/`](dsh-plugin/)).

Open-source repo: [github.com/Tencent/skillhub](https://github.com/Tencent/skillhub) · Product site: [skillhub.cn](https://skillhub.cn)

SkillHub covers discovery, install, publishing, evaluation, and execution of Skills. Developers can share Skills here; agents and applications can find and use them.

The catalog currently includes **80,000+ Skills**, **60 million+** lifetime downloads, **20 million+** downloads in a single month, and **500+** merchants.

## Repository layout

| Path | What it is |
|------|------------|
| [`docs/`](docs/) | Open API documentation, onboarding notes, and runnable examples |
| [`dsh-plugin/`](dsh-plugin/) | SkillHub plugin for DeepSeek Harness (npm: `@tencent/skillhub`) |

## Open API

The [SkillHub CLI](https://skillhub.cn) already covers discovery, install, publishing, and validation in the terminal. The HTTP + JSON APIs exist for product integrations the CLI cannot cover: embedding search and install in agents, IDEs, browser extensions, or enterprise portals; building your own skill marketplace; or syncing and governing Skills on the server.

| What you want | What the API covers |
|---------------|---------------------|
| Skill search in your product | Search, categories, rankings, recommendations, and details |
| Show and install a Skill | Files, versions, diffs, and download |
| Judge reliability | Evaluation, test results, signing, and verification |
| Publish and govern | Publishing, import, versions, org-private Skills |
| Run inside an agent | Sandbox, sessions, streaming, and file handling |

Quick start:

```bash
export SKILLHUB_BASE_URL='https://api.skillhub.cn'

curl "$SKILLHUB_BASE_URL/api/skills?sortBy=downloads&order=desc&pageSize=5"
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub"
```

Full guide, endpoint index, and conventions: [docs/README.md](docs/README.md) and [docs/api/README.md](docs/api/README.md). Runnable examples (Shell / Node.js / Python): [docs/examples/](docs/examples/)

```bash
bash docs/examples/curl/quickstart.sh
node docs/examples/node/list-skills.mjs
python3 docs/examples/python/list_skills.py
```

Public APIs can be used from the docs as-is. Org-internal Skills require membership. For high volume, sandbox, or model-heavy workloads, contact us before production using [docs/apply.md](docs/apply.md).

## DeepSeek Harness plugin

[`dsh-plugin/`](dsh-plugin/) lets you search SkillHub skills in a DeepSeek Harness conversation, open details, and install them into the local skills directory. It also supports browsing by category, version selection, uninstall, and a sidebar plugin marketplace.

Install from npm (prebuilt, no `allowBuilds` required):

```sh
dsh plugin --profile web add @tencent/skillhub
```

Local development:

```sh
dsh plugin --profile web add /absolute/path/to/skillhub/dsh-plugin
```

Then restart `dsh web` (bind `127.0.0.1`) and hard-refresh the browser. Use the scoped package `@tencent/skillhub`; the unscoped npm name `skillhub` is a different project.

Features, configuration, development, and troubleshooting: [dsh-plugin/README.md](dsh-plugin/README.md).

## Contributing and support

```bash
git clone https://github.com/Tencent/skillhub.git
```

- Start at [CONTRIBUTING.md](CONTRIBUTING.md): API docs in [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md), plugin in [dsh-plugin/CONTRIBUTING.md](dsh-plugin/CONTRIBUTING.md)
- Usage questions, doc errors, or unexpected API/plugin behavior: open a [GitHub Issue](https://github.com/Tencent/skillhub/issues)
- Security issues: do not file a public issue; follow [SECURITY.md](SECURITY.md)

## License

Released under the [MIT License](LICENSE).

Contact: [skillhub@tencent.com](mailto:skillhub@tencent.com)
