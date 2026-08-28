# 贡献指南

本目录的内容是 **公开 API 文档与调用示例**，欢迎提交改进。最常见的贡献是修正文档错误、
补充调用示例，以及反馈接口行为与文档不一致的地方。

插件相关改动请见 [dsh-plugin/CONTRIBUTING.md](../dsh-plugin/CONTRIBUTING.md)。仓库总览见根目录 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## 可以贡献什么

- 文档修正：错别字、失效链接、字段说明错误、示例命令无法运行
- 示例补充：新语言的最小可运行示例，或已有示例的可读性改进
- 一致性反馈：接口实际返回与文档描述不符

## 不接受的改动

- 新增平台内部接口、内部字段或配置说明
- 添加未经 SkillHub 团队确认的邮箱、个人联系方式或合作承诺
- 与本仓库开放范围无关的内容（见 [capabilities.md](capabilities.md)）

## 提交流程

```bash
git clone https://github.com/Tencent/skillhub.git
cd skillhub
```

1. Fork [本仓库](https://github.com/Tencent/skillhub) 并从 `main` 切出分支
2. 提交改动，一个 PR 只做一件事
3. 发起 Pull Request，说明改了什么、为什么改
4. 涉及接口行为的改动，请附上你实际执行的请求与返回（注意去掉自己的敏感信息）

改动范围较大（比如新增一门语言的示例、调整文档结构）时，建议先开一个 Issue 对齐思路，避免白做。

## 本地校验

改动示例代码后，请在仓库根目录确认示例能实际跑通：

```bash
bash docs/examples/curl/quickstart.sh
node docs/examples/node/list-skills.mjs
python3 docs/examples/python/list_skills.py
```

改动文档后，请确认新增或修改的 curl 命令能实际返回预期结果，且文内链接可跳转。

## 提交信息

使用简短的前缀标明改动类型，例如：

```
docs: 修正 files 接口的 version 参数默认值说明
example: 补充 Python 批量详情示例
fix: 修正 quickstart.sh 在 macOS 下的兼容问题
```

## 问题反馈

- 使用问题、文档错误、接口异常：提交 [GitHub Issue](https://github.com/Tencent/skillhub/issues)，附上请求路径、参数和返回内容
- 安全问题：请勿公开提交 Issue，见 [SECURITY.md](../SECURITY.md)
