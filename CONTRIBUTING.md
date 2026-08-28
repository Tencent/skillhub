# 贡献指南 / Contributing

本仓库包含三部分。请按改动范围阅读对应说明，一个 Pull Request 只做一件事。

This repository has three surfaces. Follow the guide that matches your change. Keep each pull request focused on one thing.

| 改动范围 / Area | 说明 / Guide |
|-----------------|--------------|
| Open API 文档与示例 / API docs and examples | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| DeepSeek Harness 插件 / DSH plugin | [dsh-plugin/CONTRIBUTING.md](dsh-plugin/CONTRIBUTING.md) |
| 官方 Skills / Official Skills | [`skills/`](skills/) |

```bash
git clone https://github.com/Tencent/skillhub.git
cd skillhub
```

- API 文档：修正错别字、失效链接、字段说明，或补充 [docs/examples/](docs/examples/) 中的最小可运行示例
- 插件：Bug 修复、API 兼容、测试、文档和交互优化；本地在 `dsh-plugin/` 下使用 pnpm
- 官方 Skill：改进 [`skills/`](skills/) 下的官方 Skill（说明、流程、参考资料）
- 安全问题：请勿公开提交 Issue，见 [SECURITY.md](SECURITY.md)
- Security issues: do not file a public issue; see [SECURITY.md](SECURITY.md)

较大的功能或文档结构调整，建议先开 Issue 对齐思路。
For larger features or doc-structure changes, open an issue first.
