# SkillHub Open API

> 面向 Agent 生态的技能基础设施开放接口与可运行示例。

开源仓库：[github.com/Tencent/skillhub](https://github.com/Tencent/skillhub)

SkillHub 是面向 Agent 生态的技能基础设施，提供 Skill 的发现、安装、发布、评测和运行能力。开发者可以在这里分享 Skill，Agent 和各类应用也可以直接查找和使用这些能力。

目前，SkillHub 已收录 **8 万+ Skills**，累计下载 **6000 万+ 次**，**单月下载量超过 2000 万次**，并有 **500+ 商家**入驻。

## 为什么在 CLI 之外开放 API

[SkillHub CLI](https://skillhub.cn) 已经支持 Agent 和开发者在终端中完成 Skill 的发现、安装、发布与校验。开放 API 是为了覆盖更多不能只靠 CLI 完成的产品接入场景：

- 在 Agent、IDE、浏览器插件或企业门户中内嵌 Skill 搜索与安装
- 搭建自己的技能广场、插件市场或行业 Skill 专区
- 将 SkillHub 接入官方平台、内部工作台或自动化工作流
- 按自己的产品体验展示 Skill、版本、文件、质量与运行结果
- 在服务端批量同步、治理或调用 Skill 能力

接口采用标准 HTTP + JSON，可直接用 `curl` 验证，也可以接入任意语言和技术栈。

## 开始使用

公开 API 可以直接按文档接入。访问组织内的 Skill 和数据时，需要相应的成员权限。

如果你的产品预计有较大调用量，或会使用沙箱、模型等高消耗能力，建议在上线前联系我们。我们可以一起确认调用规模、配额和稳定性方案。详细说明见 [API 使用与资源支持](docs/capabilities.md)。

## 你可以用 API 做什么

| 你想做什么 | 可以使用的能力 |
|------------|----------------|
| 在产品中加入 Skill 搜索 | 搜索、分类、榜单、推荐和详情 |
| 展示并安装 Skill | 文件、版本、版本差异和下载 |
| 帮助用户判断 Skill 是否可靠 | 评测、测试结果、签名和验签 |
| 让开发者发布 Skill | 发布、GitHub 导入、版本和可见性管理 |
| 管理企业内部 Skill | 组织成员、私有 Skill、分类和审核 |
| 在 Agent 中直接运行 Skill | 沙箱、会话、流式输出和文件处理 |
| 接入付费或行业内容 | 付费 Skill、专家包和行业 Skill |

## 当前已整理的接口文档

目前可以查阅以下接口文档，其他接口也会陆续补充：

| 能力 | 说明 | 文档 |
|------|------|------|
| Skill 检索 | 关键词、分类、来源、标签筛选，多维度排序与分页 | [skills.md](docs/api/skills.md#skill-列表) |
| Skill 详情 | 单个详情与批量详情（单次最多 1000 个 slug） | [skills.md](docs/api/skills.md#skill-详情) |
| 文件读取 | 某个版本的文件列表与单文件内容 | [files.md](docs/api/files.md) |
| 版本与差异 | 版本记录、整体差异与单文件差异 | [versions-and-diff.md](docs/api/versions-and-diff.md) |
| 质量结果 | 综合评分、评测维度与公开解释 | [evaluation.md](docs/api/evaluation.md) |
| Skill 下载 | 按版本或 tag 下载 zip 包 | [skills.md](docs/api/skills.md#下载-skill) |
| 分类与榜单 | 一级分类与 Top 排行榜 | [categories.md](docs/api/categories.md) |

接口总览与通用约定见 [docs/api/README.md](docs/api/README.md)。

## 快速开始

```bash
export SKILLHUB_BASE_URL='https://api.skillhub.cn'

# 按下载量取前 5 个 Skill
curl "$SKILLHUB_BASE_URL/api/skills?sortBy=downloads&order=desc&pageSize=5"
```

返回结构如下（完整字段说明见 [skills.md](docs/api/skills.md#skill-列表)）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 107008,
    "skills": [
      { "slug": "find-skill-skillhub", "name": "find skill", "version": "1.0.2", "downloads": 43390 }
    ]
  }
}
```

拿到 `slug` 后，可以继续查询详情、文件和版本：

```bash
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub"
```

三份可运行示例（Shell / Node.js / Python）见 [examples/](examples/)：

```bash
bash examples/curl/quickstart.sh          # 无额外依赖
node examples/node/list-skills.mjs        # Node.js 18+
python3 examples/python/list_skills.py    # Python 3.9+
```

## 使用示例

**场景一：在自己的产品中加入 Skill 搜索**

```bash
curl "$SKILLHUB_BASE_URL/api/skills?keyword=find%20skill&category=ai-agent&pageSize=10"
```

**场景二：展示某个 Skill 的版本与文件**

```bash
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/versions"
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/files?version=1.0.2"
curl -L "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/file?path=SKILL.md&version=1.0.2"
```

**场景三：下载 Skill**

```bash
curl -L -o find-skill-skillhub.zip "$SKILLHUB_BASE_URL/api/v1/download?slug=find-skill-skillhub"
```

## 什么时候需要联系我们

以下场景建议在正式上线前邮件联系我们：

- 大规模或高并发调用、批量同步全量数据
- 沙箱运行、Agent 会话、流式输出、大文件处理或模型调用
- 接入官方平台、企业级产品或其他面向大量用户的入口
- 商业化发布、付费 Skill、联合运营或正式商用
- 需要专属配额、稳定性保障或技术支持

我们会结合实际场景评估容量，并协助制定合适的接入方案。未提前沟通的调用使用共享资源，繁忙时可能出现限流或降级，不建议直接用于关键生产链路。

联系信息和建议提供的材料见 [docs/apply.md](docs/apply.md)。

> **联系邮箱：[skillhub@tencent.com](mailto:skillhub@tencent.com)**

## 使用范围

组织内部的 Skill 和数据需要相应的成员权限。平台管理、内部系统和其他组织的私有数据不提供公开访问。

## 贡献与问题反馈

```bash
git clone https://github.com/Tencent/skillhub.git
```

- 贡献流程、提交规范与文档要求见 [CONTRIBUTING.md](CONTRIBUTING.md)
- 使用问题、文档错误、接口行为与文档不符：提交 [GitHub Issue](https://github.com/Tencent/skillhub/issues)，并附请求路径、参数和脱敏后的返回内容
- 安全问题：请勿公开提交 Issue，按 [SECURITY.md](SECURITY.md) 的方式报告

## License

本仓库以 [MIT License](LICENSE) 发布。
