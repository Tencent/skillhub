# SkillHub

[中文](README.md) | [English](README_EN.md)

An AI Skills community optimized for users in China. This repository publishes two things: **Open API docs and runnable examples** ([`docs/`](docs/)), and a **DeepSeek Harness plugin** ([`dsh-plugin/`](dsh-plugin/)).

Open-source repo: [github.com/Tencent/skillhub](https://github.com/Tencent/skillhub) · Product site: [skillhub.cn](https://skillhub.cn) · [About SkillHub](https://skillhub.cn/about)

## What is SkillHub

SkillHub aggregates globally synced and locally published Skills, and provides security certification, quality evaluation, enterprise publishing, and organization skill libraries so agents can reliably get trusted capabilities.

It is built on syncing high-quality Skills worldwide, co-creating with local authors, and optimizing download experience in China. The catalog currently includes **80,000+ Skills**, **60 million+** lifetime downloads, **20 million+** downloads in a single month, and **500+** merchants.

| Capability | What it means |
|------------|----------------|
| Global sync and local publishing | Continuously syncs high-quality Skills worldwide (for example from ClawHub) and fills in Chinese descriptions, install paths, and local context. Creators, teams, and companies can also publish their own Skills — the platform is not only a mirror |
| Fast downloads in China | Download paths are optimized for networks in China, reducing failed installs, slow downloads, and unstable dependencies |
| Dual security certification | Skills on the platform go through dual security checks. Viewable reports cover prompt poisoning, malware, data-leak risk, and supply-chain risk |
| TRACE evaluation | TRACE defines how a Skill is judged and produces a review you can cite. Rankings, recency, and tags help you choose — not download count alone |
| Enterprise publishing and private libraries | Organizations can publish externally with verified (blue V) identity, or keep internal prompts, workflows, and tool recipes in a team-only skill library |
| Soul.md and skill packs | Soul.md defines how an agent speaks, acts, and collaborates; curated industry skill packs add reusable expertise on top |

Developers can share Skills here; agents and applications can find and use them. See [skillhub.cn/about](https://skillhub.cn/about) for the full product overview.

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

[`dsh-plugin/`](dsh-plugin/) lets you search SkillHub skills in a DeepSeek Harness conversation, open details, and install them into the local skills directory. It also supports browsing by category, version selection, uninstall, a sidebar plugin marketplace, and in-chat search / one-click install of DSH plugins.

Install from GitHub:

```sh
dsh plugin --profile web add github:Tencent/skillhub#path:dsh-plugin
```

You can also install from npm (prebuilt): `dsh plugin --profile web add @tencent/skillhub`.

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
