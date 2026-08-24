# 分类与基础榜单

分类字典用于给 Skill 列表做筛选，Top 排行榜用于做首页推荐位。

通用约定见 [README.md](README.md)。

- [一级分类](#一级分类)
- [Top 排行榜](#top-排行榜)

---

## 一级分类

**`GET /api/v1/categories`**

返回全部一级主分类（受控字典）。`key` 可直接用作 [Skill 列表](skills.md#skill-列表) 的 `category` 参数。

二级类目仅随 Skill 列表的 `subCategories` 字段返回，没有独立的查询接口。

### 请求参数（Query String）

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `includeInactive` | string | 否 | `false` | 传 `true` 则包含未激活分类 |

### 示例

```bash
curl "$SKILLHUB_BASE_URL/api/v1/categories"
```

### 响应

```json
{
  "items": [
    { "key": "office-efficiency", "name": "办公效率", "nameEn": "Office Efficiency", "level": 1, "sortOrder": 10, "active": true },
    { "key": "content-creation", "name": "内容创作", "nameEn": "Content Creation", "level": 1, "sortOrder": 20, "active": true }
  ],
  "count": 13
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `items[].key` | string | 分类唯一标识，用于 `category` 筛选 |
| `items[].name` | string | 中文显示名 |
| `items[].nameEn` | string | 英文显示名 |
| `items[].level` | int | 层级，一级固定为 `1` |
| `items[].sortOrder` | int | 排序权重，升序展示 |
| `items[].active` | bool | 是否激活 |
| `count` | int | 返回条数 |

### 一级分类取值

下表是当前的分类快照，按 `sortOrder` 升序：

| key | 中文名 | 英文名 |
|-----|--------|--------|
| `pay-skill` | Pay Skill | Pay Skill |
| `office-efficiency` | 办公效率 | Office Efficiency |
| `content-creation` | 内容创作 | Content Creation |
| `dev-programming` | 开发编程 | Development |
| `data-analysis` | 数据分析 | Data Analysis |
| `design-media` | 设计多媒体 | Design & Media |
| `ai-agent` | AI Agent | AI Agent |
| `knowledge-management` | 知识管理 | Knowledge Management |
| `business-ops` | 商业运营 | Business Operations |
| `education` | 教育学习 | Education |
| `professional` | 行业专业 | Professional |
| `it-ops-security` | IT 运维与安全 | IT Ops & Security |
| `life-service` | 生活服务 | Life Service |

分类字典会调整（新增分类、下线分类、改名）。请在运行时调用接口获取，不要把这张表硬编码进代码。

---

## Top 排行榜

**`GET /api/skills/top`**

综合评分前 50 的 Skill，同分按更新时间倒序。适合直接铺首页或推荐位，不支持分页和筛选。

### 示例

```bash
curl "$SKILLHUB_BASE_URL/api/skills/top"
```

### 响应

带信封格式，`data.skills[]` 字段与 [Skill 列表](skills.md#skill-列表) 一致：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 50,
    "skills": []
  }
}
```

需要按分类、来源、标签筛选，或者需要翻页时，用 [Skill 列表](skills.md#skill-列表) 接口并把 `sortBy` 设为 `score`。
