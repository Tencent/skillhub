# 版本与差异

查看 Skill 的版本记录，以及任意两个版本之间的文件级差异。

通用约定见 [README.md](README.md)。

---

## 版本列表

**`GET /api/v1/skills/{slug}/versions`**

### 参数

| 位置 | 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| path | `slug` | string | 是 | Skill 唯一标识 |

### 示例

```bash
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/versions"
```

### 响应

```json
{
  "slug": "find-skill-skillhub",
  "source": "community",
  "versions": [
    { "versionId": 102, "version": "1.0.2", "changelog": "补充分类参考文档", "createdAt": 1782461490627 },
    { "versionId": 101, "version": "1.0.1", "changelog": "修复关键词分词", "createdAt": 1782450000000 },
    { "versionId": 100, "version": "1.0.0", "changelog": "Initial release", "createdAt": 1782446361889 }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `slug` | string | Skill 唯一标识 |
| `source` | string | Skill 来源 |
| `versions[].versionId` | int | 版本 ID |
| `versions[].version` | string | 版本号（semver） |
| `versions[].changelog` | string | 变更日志 |
| `versions[].createdAt` | int | 发布时间（毫秒时间戳） |

版本按发布时间倒序返回，第一项为最新版本。

### 可见性规则

只返回公开可见的版本：社区来源仅包含审核通过的版本，待审核与未通过的版本不会出现在列表中。

### 错误码

| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `missing slug` | 未提供 slug |
| 404 | `skill not found` | Skill 不存在或不公开可见 |

---

## 版本差异

**`GET /api/v1/skills/{slug}/diff`**

对比两个版本的文件构成，返回增删改统计和逐文件状态。差异依据文件 SHA256 判定，不读取文件内容。

### 参数

| 位置 | 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| path | `slug` | string | 是 | Skill 唯一标识 |
| query | `base` | string | 是 | 基线版本号 |
| query | `target` | string | 是 | 目标版本号 |

### 示例

```bash
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/diff?base=1.0.0&target=1.0.2"
```

### 响应

```json
{
  "slug": "find-skill-skillhub",
  "base": "1.0.0",
  "target": "1.0.2",
  "summary": { "added": 1, "removed": 0, "changed": 2, "unchanged": 5 },
  "files": [
    {
      "path": "SKILL.md",
      "status": "changed",
      "baseSize": 2048,
      "targetSize": 2312,
      "baseSha256": "a1b2c3...",
      "targetSha256": "f6e5d4..."
    },
    {
      "path": "src/new.py",
      "status": "added",
      "baseSize": null,
      "targetSize": 512,
      "baseSha256": null,
      "targetSha256": "9c8b7a..."
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `summary.added` | int | 新增文件数 |
| `summary.removed` | int | 删除文件数 |
| `summary.changed` | int | 内容变更文件数 |
| `summary.unchanged` | int | 未变更文件数 |
| `files[].path` | string | 文件相对路径 |
| `files[].status` | string | `added` / `removed` / `changed` / `unchanged` |
| `files[].baseSize` | int\|null | 基线侧大小，文件在基线不存在时为 `null` |
| `files[].targetSize` | int\|null | 目标侧大小，文件在目标不存在时为 `null` |
| `files[].baseSha256` | string\|null | 基线侧 SHA256 |
| `files[].targetSha256` | string\|null | 目标侧 SHA256 |

`files` 按路径升序返回，包含 `unchanged` 项，便于直接渲染完整文件树。

### 错误码

| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `missing slug, base or target` | 参数缺失 |
| 404 | `skill not found` | Skill 不存在或不公开可见 |
| 404 | `version not found or no files` | 版本不存在或无文件 |

> `base` 与 `target` 都必须是公开可见的版本，否则统一返回 404。

---

## 单文件差异

**`GET /api/v1/skills/{slug}/diff/file`**

在版本差异的基础上，返回指定文件在两侧的文本内容，可直接喂给 diff 渲染组件。

### 参数

| 位置 | 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| path | `slug` | string | 是 | Skill 唯一标识 |
| query | `base` | string | 是 | 基线版本号 |
| query | `target` | string | 是 | 目标版本号 |
| query | `path` | string | 是 | 文件相对路径 |

### 示例

```bash
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/diff/file?base=1.0.0&target=1.0.2&path=SKILL.md"
```

### 响应

```json
{
  "slug": "find-skill-skillhub",
  "base": "1.0.0",
  "target": "1.0.2",
  "path": "SKILL.md",
  "status": "changed",
  "tooLarge": false,
  "baseFile": {
    "exists": true,
    "size": 2048,
    "sha256": "a1b2c3...",
    "text": "# Skill\n..."
  },
  "targetFile": {
    "exists": true,
    "size": 2312,
    "sha256": "f6e5d4...",
    "text": "# Skill\n..."
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | `added` / `removed` / `changed` / `unchanged` |
| `tooLarge` | boolean | 任一侧文件超过 1MB 时为 `true`，此时不返回 `text` |
| `baseFile.exists` | boolean | 文件在基线版本是否存在 |
| `baseFile.size` | int\|null | 文件大小（字节） |
| `baseFile.sha256` | string\|null | 文件内容的 SHA256 |
| `baseFile.text` | string\|null | 文件文本内容，`tooLarge=true` 或文件不存在时为 `null` |
| `targetFile.*` | — | 结构同 `baseFile` |

### 限制

任一侧文件超过 **1MB** 时，响应只返回元数据并置 `tooLarge=true`，不返回文本内容。
这类文件请改用 [单文件内容接口](files.md#单文件内容) 或下载 zip 包后本地对比。

### 错误码

| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `missing slug, base, target or path` | 参数缺失 |
| 404 | `skill not found` | Skill 不存在或不公开可见 |
| 404 | `version not found or no files` | 版本不存在或无文件 |
| 404 | `file not found` | 该文件在两个版本中都不存在 |

---

## 典型场景：版本对比视图

```bash
# 1. 取版本列表，让用户选两个版本
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/versions"

# 2. 取整体差异，渲染变更文件列表
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/diff?base=1.0.0&target=1.0.2"

# 3. 用户点开某个变更文件，取两侧文本做 diff 渲染
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/diff/file?base=1.0.0&target=1.0.2&path=SKILL.md"
```

整体差异只查元数据，响应很快，适合先渲染列表再按需拉取单文件内容。
