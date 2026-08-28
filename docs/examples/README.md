# 示例

每个示例都是独立的最小可运行程序，只依赖标准库或系统自带工具，不需要安装任何包。

| 示例 | 依赖 | 做了什么 |
|------|------|----------|
| [curl/quickstart.sh](curl/quickstart.sh) | bash + curl（`jq` 可选） | 完整走一遍：列表 → 详情 → 版本 → 文件 → 质量结果 → 下载地址 |
| [node/list-skills.mjs](node/list-skills.mjs) | Node.js 18+ | 列表 + 详情 + 批量详情 |
| [python/list_skills.py](python/list_skills.py) | Python 3.9+ | 列表 + 详情 + 批量详情 |

## 运行

在仓库根目录执行：

```bash
bash docs/examples/curl/quickstart.sh
node docs/examples/node/list-skills.mjs
python3 docs/examples/python/list_skills.py
```

`quickstart.sh` 可以带一个 slug 参数，换成你关心的 Skill：

```bash
bash docs/examples/curl/quickstart.sh find-skill-skillhub
```

## 配置

默认请求 `https://api.skillhub.cn`，可用环境变量覆盖：

```bash
export SKILLHUB_BASE_URL='https://api.skillhub.cn'

# 团队标识 Key，用于识别调用来源
export SKILLHUB_API_KEY='your-team-api-key'
```

`SKILLHUB_API_KEY` 请只在服务端设置，不要写进前端代码或提交到仓库。
