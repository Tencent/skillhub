# SkillHub Open API 参考

本目录提供 SkillHub Open API 的接口说明和调用示例。访问组织内的 Skill 和数据时，需要相应的成员权限。生产接入注意事项见 [使用说明](../capabilities.md)。

## Base URL

```bash
export SKILLHUB_BASE_URL='https://api.skillhub.cn'
```

## 当前接口总览

| 能力 | 方法 | 路径 | 文档 |
|------|------|------|------|
| Skill 列表（分页筛选） | GET | `/api/skills` | [skills.md](skills.md#skill-列表) |
| Top 排行榜 | GET | `/api/skills/top` | [categories.md](categories.md) |
| Skill 详情 | GET | `/api/v1/skills/{slug}` | [skills.md](skills.md#skill-详情) |
| 批量 Skill 详情 | POST | `/api/v1/skills/batch` | [skills.md](skills.md#批量-skill-详情) |
| 下载 Skill | GET | `/api/v1/download` | [skills.md](skills.md#下载-skill) |
| 文件列表 | GET | `/api/v1/skills/{slug}/files` | [files.md](files.md#文件列表) |
| 单文件内容 | GET | `/api/v1/skills/{slug}/file` | [files.md](files.md#单文件内容) |
| 版本列表 | GET | `/api/v1/skills/{slug}/versions` | [versions-and-diff.md](versions-and-diff.md) |
| 版本差异 | GET | `/api/v1/skills/{slug}/diff` | [versions-and-diff.md](versions-and-diff.md) |
| 单文件差异 | GET | `/api/v1/skills/{slug}/diff/file` | [versions-and-diff.md](versions-and-diff.md) |
| 质量结果 | GET | `/api/v1/skills/{slug}/evaluation` | [evaluation.md](evaluation.md) |
| 一级分类 | GET | `/api/v1/categories` | [categories.md](categories.md) |

更多可公开接口会持续补充到本目录。

## 调用标识 Header

这两个 Header 用于识别调用来源、统计调用量。建议接入时就带上，后续 `X-API-Key` 会要求必填：

| Header | 说明 |
|--------|------|
| `X-API-Key` | 团队标识 Key，用于识别调用来源 |
| `X-Client-User-Id` | 调用方的用户标识，建议传脱敏值（如 `sha256(userId)` 前 16 位），用于统计独立用户数 |

```bash
curl "$SKILLHUB_BASE_URL/api/skills?keyword=find%20skill&pageSize=10" \
  -H "X-API-Key: your-team-api-key" \
  -H "X-Client-User-Id: a1b2c3d4e5f6"
```

`X-API-Key` 属于敏感信息，请只在服务端使用，不要写入前端代码或公开仓库。

如果预计有较大调用量，会使用沙箱或模型资源，或计划接入官方平台、正式商用，请在上线前按 [联系我们](../apply.md) 提供相关信息。我们会协助评估容量和接入方案。

## 响应格式

两类路径的响应格式不同，接入时注意区分。

**`/api/v1/*`** 直接返回业务对象：

```json
{ "slug": "find-skill-skillhub", "category": "ai-agent" }
```

**`/api/skills`、`/api/skills/top`** 这类早期接口外面还有一层信封，业务数据在 `data` 中：

```json
{
  "code": 0,
  "message": "success",
  "data": { "total": 107008, "skills": [] }
}
```

## 错误响应

错误统一返回：

```json
{ "error": "错误描述信息" }
```

常见状态码：

| 状态码 | 说明 |
|--------|------|
| 400 | 参数缺失或非法 |
| 404 | 资源不存在，或资源不公开可见 |
| 413 | 请求内容超出大小限制 |
| 429 | 触发调用频率或资源限制 |
| 500 | 服务端错误 |
| 503 | 服务或依赖暂时不可用 |

## 关于文档中的示例

- **curl 命令**统一使用公开 Skill `find-skill-skillhub`，可以直接复制运行
- **JSON 响应**的字段名和类型是准确的，取值仅为示意，会随线上数据变化
- 响应中可能出现文档未列出的字段；未在文档中说明的字段不属于公开约定，请不要依赖

## 通用约定

- **时间戳**：所有时间字段为 Unix **毫秒**时间戳（13 位整数）
- **版本号**：遵循 semver，如 `1.0.1`
- **可见性**：不公开可见的资源统一返回 404，不区分“不存在”与“无权访问”
- **302 重定向**：单文件内容与下载接口返回 302 跳转到对象存储地址，客户端需跟随重定向（`curl -L`）
- **限速与重试**：服务端会根据共享资源负载进行频率和并发保护，请对 `429`、`5xx` 和超时做指数退避
- **服务说明**：默认调用使用共享资源；如需专属容量或稳定性保障，请在上线前联系我们
