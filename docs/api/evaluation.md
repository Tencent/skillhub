# 基础质量结果

返回 Skill 的质量评分、基础维度得分与公开解释，可用于在自己的界面上展示质量参考。

通用约定见 [README.md](README.md)。

---

## 获取质量结果

**`GET /api/v1/skills/{slug}/evaluation`**

### 参数

| 位置 | 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| path | `slug` | string | 是 | Skill 唯一标识 |

### 示例

```bash
curl "$SKILLHUB_BASE_URL/api/v1/skills/find-skill-skillhub/evaluation"
```

### 响应

```json
{
  "skillId": 12345,
  "versionId": 101,
  "dimensions": {
    "trust": {
      "userReason": "来源可核验，未发现风险项",
      "items": {
        "scan": { "score": 4.5, "userReason": "安全扫描通过" },
        "domestic": { "score": 4.0, "userReason": "依赖可在国内环境正常获取" }
      }
    },
    "reliability": {
      "userReason": "多次执行结果稳定",
      "items": {
        "stability": { "score": 4.2, "userReason": "重复执行输出一致" },
        "func": { "score": 4.0, "userReason": "核心功能完整可用" },
        "errorHandling": { "score": 3.5, "userReason": "异常场景有基本处理" }
      }
    },
    "adaptability": { "userReason": "触发边界清晰", "items": {} },
    "convention": { "userReason": "文档结构规范", "items": {} },
    "effectiveness": { "userReason": "输出准确可用", "items": {} }
  },
  "userSummary": "整体质量良好，适合直接使用。",
  "createdAt": 1773843900000,
  "updatedAt": 1773850000000
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `skillId` | int | Skill ID |
| `versionId` | int | 本次评估对应的版本 ID |
| `dimensions` | object | 五个基础维度，见下表 |
| `dimensions.{dim}.userReason` | string\|null | 该维度的公开解释 |
| `dimensions.{dim}.items` | object | 维度下的子项，key 为子项标识 |
| `dimensions.{dim}.items.{item}.score` | float\|null | 子项得分，满分 5 分，保留 1 位小数；未评估时为 `null` |
| `dimensions.{dim}.items.{item}.userReason` | string | 子项的公开解释 |
| `userSummary` | string\|null | 整体评价的公开解释 |
| `createdAt` | int | 评估创建时间（毫秒时间戳） |
| `updatedAt` | int | 评估更新时间（毫秒时间戳） |

> 响应中可能出现本文未列出的字段。未在本文档中说明的字段不属于公开约定，请不要依赖。

### 基础维度

| 维度 key | 含义 | 子项 |
|----------|------|------|
| `trust` | 可信度：来源与安全风险 | `scan`（安全扫描结果汇总）、`domestic`（国内环境可用性） |
| `reliability` | 可靠性：执行是否稳定可用 | `stability`、`func`、`errorHandling` |
| `adaptability` | 适应性：触发与边界是否清晰 | `boundary`、`trigger` |
| `convention` | 规范性：结构与文档质量 | `progressive`、`structure`、`docQuality`、`antiPatternFaq` |
| `effectiveness` | 有效性：产出是否好用 | `accuracy`、`completeness`、`usability`、`creativity` |

子项集合可能随评估体系演进而调整，请按 `items` 的实际 key 遍历渲染，不要硬编码固定子项列表。

### 总分计算

接口不直接返回总分。展示总分时按「先算维度均分、再对五个维度取平均」计算，保留 1 位小数：

```javascript
const DIMS = ['trust', 'reliability', 'adaptability', 'convention', 'effectiveness'];

function totalScore(evaluation) {
  const dimScores = DIMS.map((dim) => {
    const items = Object.values(evaluation.dimensions[dim]?.items || {});
    const scores = items.map((i) => i.score).filter((s) => s !== null);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  });
  return (dimScores.reduce((a, b) => a + b, 0) / dimScores.length).toFixed(1);
}
```

### 错误码

| 状态码 | error | 说明 |
|--------|-------|------|
| 404 | `skill not found` | Skill 不存在或不公开可见 |
| 404 | `evaluation not found` | 该 Skill 尚无评估结果 |

### 说明

- 评估针对**具体版本**，`versionId` 表示结果对应的版本；Skill 发布新版本后结果会更新
- 尚未完成评估的 Skill 返回 404，请把「无评估结果」作为正常状态处理
- 评分与解释是质量参考，不构成对 Skill 行为的保证
