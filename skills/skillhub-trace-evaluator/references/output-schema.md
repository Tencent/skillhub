# 报告输出 Schema

交付前用包内脚本校验（相对 skill 根目录）：

```bash
python scripts/validate_trace_scores.py report.json
```

文档与示例以 **camelCase** 为准；校验脚本同时接受 `user_reason` / `user_summary` 等 snake_case。

## JSON 形状

```json
{
  "dimensions": {
    "trust": {
      "reason": "维度总评（开发者）",
      "userReason": "维度总评（用户）",
      "items": {
        "scan": {
          "status": "skipped",
          "reason": "本评测不做安全扫描，不评分",
          "userReason": "未做安全扫描，此项跳过"
        },
        "domestic": {
          "score": 4.0,
          "reason": "开发者理由",
          "userReason": "用户理由"
        }
      }
    },
    "reliability": {
      "reason": "...",
      "userReason": "...",
      "items": {
        "stability": { "score": 3.5, "reason": "...", "userReason": "..." },
        "func": { "score": 4.0, "reason": "...", "userReason": "..." },
        "errorHandling": { "score": 3.0, "reason": "...", "userReason": "..." }
      }
    },
    "adaptability": {
      "reason": "...",
      "userReason": "...",
      "items": {
        "boundary": { "score": 4.0, "reason": "...", "userReason": "..." },
        "trigger": { "score": 4.5, "reason": "...", "userReason": "..." }
      }
    },
    "convention": {
      "reason": "...",
      "userReason": "...",
      "items": {
        "progressive": { "score": 4.0, "reason": "...", "userReason": "..." },
        "structure": { "score": 4.0, "reason": "...", "userReason": "..." },
        "docQuality": { "score": 3.5, "reason": "...", "userReason": "..." },
        "antiPatternFaq": { "score": 2.5, "reason": "...", "userReason": "..." }
      }
    },
    "effectiveness": {
      "reason": "...",
      "userReason": "...",
      "items": {
        "accuracy": { "score": 4.0, "reason": "...", "userReason": "..." },
        "completeness": { "score": 4.0, "reason": "...", "userReason": "..." },
        "usability": { "score": 4.0, "reason": "...", "userReason": "..." },
        "creativity": { "score": 3.5, "reason": "...", "userReason": "..." }
      }
    }
  },
  "summary": "面向开发者的总体评价（连贯段落）",
  "userSummary": "面向普通用户的质量总评"
}
```

## 合规要点（脚本强制）

| 规则 | 说明 |
|------|------|
| 顶层 | 必须有 `dimensions`、`summary`、`userSummary` |
| 五维齐全 | `trust` / `reliability` / `adaptability` / `convention` / `effectiveness` |
| 子项齐全 | 见上表；未知子项报错 |
| 分数 | 普通子项 `0 < score <= 5.0` |
| scan | 仅 `trust.scan` 可 `status: "skipped"`（可无 score）；其它子项禁止 skipped |
| 文案 | 维度与子项的 `reason` / `userReason` 非空 |

脚本**不校验**字数区间、敏感词、是否真实读过文件。

## 人类可读模板

```
【TRACE 评测】trust.scan 已跳过

| 维度 | 子项均分（近似） | 要点 |
|------|------------------|------|
| Trust | … | scan=skipped；domestic=… |
| Reliability | … | … |
| Adaptability | … | … |
| Convention | … | … |
| Effectiveness | … | … |

### Trust
- scan: skipped — …
- domestic: {score} — {简短理由}

…

### 摘要（开发者）
{summary}

### 摘要（用户）
{userSummary}

### 完整 JSON
（已通过 validate_trace_scores.py）
```
