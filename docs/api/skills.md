# Skill 列表、详情与下载

最常用的一组接口：先用列表接口按条件找到 `slug`，再用 `slug` 查详情、下载 zip 包。

通用约定（Base URL、Header、错误格式、时间戳）见 [README.md](README.md)。

- [Skill 列表](#skill-列表)
- [Skill 详情](#skill-详情)
- [批量 Skill 详情](#批量-skill-详情)
- [下载 Skill](#下载-skill)

---

## Skill 列表

**`GET /api/skills`**

按关键词、分类、来源、标签筛选的分页列表，支持多维度排序。

### 请求参数（Query String）

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | int | 否 | `1` | 页码，≥1 |
| `pageSize` | int | 否 | `20` | 每页数量，范围 1~100 |
| `sortBy` | string | 否 | `updated_at` | 排序字段，见下表 |
| `order` | string | 否 | `desc` | 排序方向：`asc` / `desc` |
| `keyword` | string | 否 | — | 关键词模糊搜索（匹配 slug、名称、中英文描述） |
| `slug` | string | 否 | — | 按 slug 精确筛选 |
| `category` | string | 否 | — | 按一级分类 key 筛选，取值见 [categories.md](categories.md) |
| `source` | string | 否 | — | 按来源筛选，常见取值 `community`（社区发布）、`official`（官方发布） |
| `labels` | string | 否 | — | 按属性标签筛选，见下方说明 |

**sortBy 可选值**

| 值 | 说明 |
|------|------|
| `updated_at` | 按更新时间排序（默认） |
| `downloads` | 按下载量排序 |
| `stars` | 按收藏数排序 |
| `installs` | 按安装量排序 |
| `score` | 按综合评分排序 |

**labels 语法**

格式为 `key1:value1,key2:value2`，多个条件为 AND 关系。支持否定语法 `key:!value`。

| 示例 | 含义 |
|------|------|
| `labels=requires_api_key:true` | 需要 API Key 的 Skill |
| `labels=requires_api_key:false` | 不需要 API Key 的 Skill |
| `labels=pricing_type:paid` | 付费 Skill |
| `labels=pricing_type:!paid` | 非付费 Skill |

### 示例

```bash
# 默认列表
curl "$SKILLHUB_BASE_URL/api/skills"

# 按下载量倒序
curl "$SKILLHUB_BASE_URL/api/skills?sortBy=downloads&order=desc&page=1&pageSize=20"

# 关键词搜索
curl "$SKILLHUB_BASE_URL/api/skills?keyword=find%20skill&pageSize=10"

# 分类 + 排序组合
curl "$SKILLHUB_BASE_URL/api/skills?category=ai-agent&sortBy=score&order=desc&pageSize=20"

# 只看免费 Skill
curl "$SKILLHUB_BASE_URL/api/skills?labels=pricing_type:!paid&pageSize=20"
```

### 响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 107008,
    "skills": [
      {
        "slug": "find-skill-skillhub",
        "source": "community",
        "iconUrl": "https://example.com/icon.png",
        "ownerName": "user_290ac21c",
        "category": "ai-agent",
        "name": "find skill",
        "description": "在 SkillHub 平台查找/搜索 Skill 技能",
        "description_zh": "在 SkillHub 平台查找/搜索 Skill 技能",
        "version": "1.0.2",
        "homepage": "https://api.skillhub.cn/user_290ac21c/find-skill-skillhub",
        "tags": ["latest"],
        "subCategories": [
          { "key": "agent-tool-use", "name": "工具调用" }
        ],
        "downloads": 43390,
        "stars": 176,
        "installs": 0,
        "created_at": 1742000000000,
        "updated_at": 1742100000000,
        "score": 100000,
        "labels": { "requires_api_key": "true" }
      }
    ]
  }
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `total` | int | 符合筛选条件的总数 |
| `skills[].slug` | string | Skill 唯一标识 |
| `skills[].source` | string | 来源标识，常见 `community` / `official`；取值可能扩展，请按字符串处理 |
| `skills[].iconUrl` | string\|null | 图标 URL，无图标时为 `null` |
| `skills[].ownerName` | string | 作者 handle |
| `skills[].category` | string | 一级分类 key |
| `skills[].name` | string | 显示名称 |
| `skills[].description` | string | 英文描述 |
| `skills[].description_zh` | string | 中文描述，无中文时回退到英文 |
| `skills[].version` | string | 最新版本号 |
| `skills[].homepage` | string | Skill 主页 URL |
| `skills[].tags` | string[] | 标签列表，无标签时为空数组 |
| `skills[].subCategories` | object[] | 二级类目，每项 `{key, name}`，无则为空数组（仅随列表返回，无独立查询接口） |
| `skills[].downloads` | int | 下载量 |
| `skills[].stars` | int | 收藏数 |
| `skills[].installs` | int | 安装量 |
| `skills[].created_at` | int | 创建时间（毫秒时间戳） |
| `skills[].updated_at` | int | 更新时间（毫秒时间戳） |
| `skills[].score` | float | 综合评分，仅用于排序，值越大越热门 |
| `skills[].labels` | object\|null | 属性标签键值对，无标签时为 `null` 或空对象 |

常见 label：`requires_api_key`（`"true"` / `"false"`）、`pricing_type`（`"paid"`）。

## Skill 详情

**`GET /api/v1/skills/{slug}`**

获取单个 Skill 的详情，含最新版本与作者信息。

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | string | 是 | Skill 唯一标识 |

### 示例

```bash
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub"
```

### 响应

```json
{
  "skill": {
    "slug": "find-skill-skillhub",
    "category": "ai-agent",
    "source": "community",
    "iconUrl": "https://example.com/icon.png",
    "displayName": "find skill",
    "summary": "在 SkillHub 平台查找/搜索 Skill 技能",
    "summary_zh": "在 SkillHub 平台查找/搜索 Skill 技能",
    "tags": { "latest": "1.0.2" },
    "stats": {
      "downloads": 43390,
      "stars": 176,
      "installs": 0,
      "versions": 3
    },
    "createdAt": 1742000000000,
    "updatedAt": 1742100000000,
    "labels": { "requires_api_key": "true" }
  },
  "latestVersion": {
    "version": "1.0.2",
    "createdAt": 1782461490627,
    "changelog": "Bug fixes and performance improvements"
  },
  "owner": {
    "handle": "user_290ac21c",
    "displayName": "SkillHub",
    "image": null
  }
}
```

### 响应字段说明

**skill 对象**

| 字段 | 类型 | 说明 |
|------|------|------|
| `slug` | string | Skill 唯一标识 |
| `category` | string | 一级分类 key |
| `source` | string | 来源标识，常见 `community` / `official`；取值可能扩展，请按字符串处理 |
| `iconUrl` | string\|null | 图标 URL |
| `displayName` | string | 显示名称 |
| `summary` | string | 英文描述 |
| `summary_zh` | string | 中文描述 |
| `tags` | object | tag 名称到版本号的映射，如 `{"latest": "1.0.2"}` |
| `stats.downloads` | int | 下载量 |
| `stats.stars` | int | 收藏数 |
| `stats.installs` | int | 安装量 |
| `stats.versions` | int | 版本数 |
| `createdAt` | int | 创建时间（毫秒时间戳） |
| `updatedAt` | int | 更新时间（毫秒时间戳） |
| `labels` | object\|null | 属性标签键值对 |

**latestVersion 对象**

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | string | 最新版本号（semver） |
| `createdAt` | int | 版本发布时间（毫秒时间戳） |
| `changelog` | string | 变更日志 |

**owner 对象**

| 字段 | 类型 | 说明 |
|------|------|------|
| `handle` | string | 作者 handle |
| `displayName` | string | 显示名称 |
| `image` | string\|null | 头像 URL |

> 响应中可能出现本文未列出的字段。未在本文档中说明的字段不属于公开约定，请不要依赖。

### 错误码

| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `missing slug` | 未提供 slug |
| 404 | `skill not found` | Skill 不存在或不公开可见 |

---

## 批量 Skill 详情

**`POST /api/v1/skills/batch`**

按 slug 批量获取详情。命中项按请求顺序返回，未命中的 slug 出现在 `missing` 中。

### 请求体（JSON）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slugs` | string[] | 是 | slug 列表，最多 1000 个 |

### 示例

```bash
curl -X POST "$SKILLHUB_BASE_URL/api/v1/skills/batch" \
  -H 'Content-Type: application/json' \
  -d '{"slugs":["find-skill-skillhub","not-exist-skill"]}'
```

### 响应

```json
{
  "items": [
    { "skill": { "slug": "find-skill-skillhub" }, "latestVersion": {}, "owner": {} }
  ],
  "missing": ["not-exist-skill"]
}
```

`items[]` 单项结构与 [Skill 详情](#skill-详情) 一致。

---

## 下载 Skill

**`GET /api/v1/download`**

下载 Skill 的 zip 包。返回 **302 重定向** 到对象存储上的下载地址。

### 请求参数（Query String）

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `slug` | string | 是 | — | Skill 唯一标识 |
| `version` | string | 否 | 最新版本 | 指定版本号（semver） |
| `tag` | string | 否 | — | 按 tag 下载，如 `latest` |

`version` 和 `tag` 都不传时下载最新版本；两者都传时以 `version` 为准。

### 示例

```bash
# 下载最新版本
curl -L -o find-skill-skillhub.zip "$SKILLHUB_BASE_URL/api/v1/download?slug=find-skill-skillhub"

# 下载指定版本
curl -L -o find-skill-skillhub-1.0.0.zip "$SKILLHUB_BASE_URL/api/v1/download?slug=find-skill-skillhub&version=1.0.0"

# 按 tag 下载
curl -L -o find-skill-skillhub.zip "$SKILLHUB_BASE_URL/api/v1/download?slug=find-skill-skillhub&tag=latest"

# 只看重定向地址，不实际下载
curl -i "$SKILLHUB_BASE_URL/api/v1/download?slug=find-skill-skillhub"
```

### 响应

`302 Found`，`Location` 指向 zip 包的下载地址：

```
HTTP/1.1 302 Found
Location: https://<对象存储域名>/<对象路径>
```

客户端需要跟随重定向（`curl -L`，浏览器和大多数 HTTP 库默认跟随）。

### 使用建议

- **不要缓存或转发 `Location` 地址**：该地址可能带时效签名，过期后失效，每次下载都重新请求本接口
- **校验完整性**：解压后可用 [文件列表接口](files.md#文件列表) 返回的 `sha256` 逐个校验文件
- **统计口径**：本接口的调用会计入 Skill 的下载量

### 错误码

| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `Missing slug` | 未提供 slug |
| 404 | `Skill not found` | Skill 不存在或不公开可见 |
| 404 | `Version not found` | 指定的 version 或 tag 不存在 |
