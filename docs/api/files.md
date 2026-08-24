# 公开文件读取

读取 Skill 某个版本内的文件列表和单个文件内容，适合做文件树浏览、代码查看器、文档预览。

通用约定见 [README.md](README.md)。

---

## 文件列表

**`GET /api/v1/skills/{slug}/files`**

返回某版本的全部文件，含路径、大小和 SHA256。

### 参数

| 位置 | 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| path | `slug` | string | 是 | — | Skill 唯一标识 |
| query | `version` | string | 否 | 最新版本 | 版本号，不传取最新版本 |

### 示例

```bash
# 最新版本
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/files"

# 指定版本
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/files?version=1.0.2"
```

### 响应

```json
{
  "files": [
    { "path": "SKILL.md", "size": 2048, "sha256": "a1b2c3d4e5f6..." },
    { "path": "references/api.md", "size": 512, "sha256": "d4e5f6a7b8c9..." }
  ],
  "count": 2,
  "version": "1.0.2"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `files[].path` | string | 文件相对路径 |
| `files[].size` | int | 文件大小（字节） |
| `files[].sha256` | string | 文件内容的 SHA256 |
| `count` | int | 文件总数 |
| `version` | string | 实际返回的版本号 |

### 错误码

| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `missing slug` | 未提供 slug |
| 404 | `skill not found` | Skill 不存在或不公开可见 |
| 404 | `version not found or no files` | 版本不存在或该版本无文件 |

---

## 单文件内容

**`GET /api/v1/skills/{slug}/file`**

返回 **302 重定向** 到对象存储地址，由客户端直接拉取内容。

### 参数

| 位置 | 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| path | `slug` | string | 是 | — | Skill 唯一标识 |
| query | `path` | string | 是 | — | 文件相对路径，如 `SKILL.md` |
| query | `version` | string | 否 | 最新版本 | 版本号 |

### 示例

```bash
# 跟随重定向拿到文件内容
curl -L "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/file?path=SKILL.md"

# 指定版本
curl -L "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/file?path=references/api.md&version=1.0.2"

# 只看重定向响应头
curl -i "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/file?path=SKILL.md"
```

### 响应

`302 Found`，响应头带文件元信息：

| Header | 说明 |
|--------|------|
| `Location` | 文件直链地址 |
| `Cache-Control` | 版本发布后文件不可变，可长期缓存 |
| `X-Content-SHA256` | 文件内容的 SHA256 |
| `X-Content-Size` | 文件大小（字节） |

### 限制

单文件预览上限 **1MB**，超过返回 413。需要完整内容请用 [下载接口](skills.md#下载-skill) 取 zip 包。

### 错误码

| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `missing slug` | 未提供 slug |
| 400 | `missing path parameter` | 未提供 path |
| 404 | `skill not found` | Skill 不存在或不公开可见 |
| 404 | `version not found or no files` | 版本不存在或该版本无文件 |
| 404 | `file not found` | 文件不存在 |
| 413 | `file too large for preview (max 1MB)` | 文件超过 1MB |

---

## 典型场景：文件浏览器

```bash
# 1. 取版本列表，做版本选择器
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/versions"

# 2. 取该版本文件列表，渲染文件树
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/files?version=1.0.2"

# 3. 用户点开某个文件，拉取内容
curl -L "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/file?path=SKILL.md&version=1.0.2"
```

文件列表里的 `sha256` 可用作前端缓存 key：版本发布后文件不可变，sha256 不变即内容不变。
