---
name: skillhub-trace-evaluator
description: "按 TRACE 框架（Trust / Reliability / Adaptability / Convention / Effectiveness，5 维 15 子项）评测 Skill 包质量。当用户说『用 TRACE 评测』『评一下这个 skill』『skill 质量打分』『五维度评测』『帮我评估这个技能包』『TRACE evaluation』等需要给 Skill 打分出报告时使用本技能。"
---

# TRACE 评测师

对本地 Skill 包按 TRACE 五维标准打分并输出报告。

评分细则见 [references/](references/)；输出格式见 [references/output-schema.md](references/output-schema.md)。

## 核心流程

必须走完下列步骤，**不要**在未读包内容时凭空打分。

### Step 1 · 定位目标包

按优先级：

1. 本地目录（根目录须有 `SKILL.md`）
2. 本地 zip（解压后同上）
3. 已安装 skill 路径
4. 仅给 slug：先拿到本地副本；**拿不到包则停止，说明无法盲评**

确认存在 `SKILL.md` 后再继续。

### Step 2 · 探索

按 [references/explore.md](references/explore.md)：列目录 → 必读 `SKILL.md` → 按需读关键文件。大文件只看前 50–100 行；抓住证据即可。

禁止编造未读文件内容作为评分依据。

### Step 3 · 分维评分

一次评一个维度，打开对应参考：

| 维度 | 参考 |
|------|------|
| Trust | [references/trust.md](references/trust.md) |
| Reliability | [references/reliability.md](references/reliability.md) |
| Adaptability | [references/adaptability.md](references/adaptability.md) |
| Convention | [references/convention.md](references/convention.md) |
| Effectiveness | [references/effectiveness.md](references/effectiveness.md) |

规则：

- 分数 **`(0, 5.0]`**；缺失方面给 **1.0–2.0**
- 每子项写 `reason`（开发者）与 `userReason`（普通用户，勿写成功能介绍）
- **`trust.scan` 固定 `status: "skipped"`**（本 skill 不做安全扫描）；只评 `trust.domestic`
- 描述依赖与网络可达性时只用中性表述（如「可直接访问」「部分依赖不易直接访问」）

### Step 4 · 摘要

- `summary`：面向开发者，连贯段落，优缺点与改进方向
- `userSummary`：面向普通用户，质量好坏与优缺点，勿写成使用说明

### Step 5 · 组装报告并校验

1. 按 [references/output-schema.md](references/output-schema.md) 写出 JSON
2. **必须**跑校验；失败则修正后再交用户：

```bash
python scripts/validate_trace_scores.py report.json
# 或 stdin
python scripts/validate_trace_scores.py -
```

exit `0` 才合规；不合规 JSON 不得交给用户。

### Step 6 · 交付

1. 人类可读：五维表格 + 各子项分数与简要理由 + 两段摘要（注明 `trust.scan` 已跳过）
2. 附上已通过校验的完整 JSON

## 禁止项

- 未探索就打分 / 编造文件证据
- 输出不合规分数（`≤0` 或 `>5`）或缺少必填子项
- 把非 `trust.scan` 的子项标为 `skipped`
