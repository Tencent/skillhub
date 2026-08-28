#!/usr/bin/env bash
# SkillHub 公开 API 快速上手：列表 -> 详情 -> 版本 -> 文件 -> 质量结果
#
# 用法：
#   bash docs/examples/curl/quickstart.sh [slug]
#
# 环境变量：
#   SKILLHUB_BASE_URL  接口地址，默认 https://api.skillhub.cn
#   SKILLHUB_API_KEY   团队标识 Key（可选）

set -euo pipefail

BASE_URL="${SKILLHUB_BASE_URL:-https://api.skillhub.cn}"
DEMO_SLUG="find-skill-skillhub"

CURL_ARGS=(--silent --show-error --fail-with-body --max-time 20)
if [[ -n "${SKILLHUB_API_KEY:-}" ]]; then
  CURL_ARGS+=(-H "X-API-Key: ${SKILLHUB_API_KEY}")
fi

if command -v jq >/dev/null 2>&1; then
  HAS_JQ=1
else
  HAS_JQ=0
  echo "提示：未安装 jq，将直接输出原始 JSON。安装 jq 可获得更易读的输出。" >&2
fi

# 输出 JSON：有 jq 就按表达式提取，没有就原样打印
show() {
  local json="$1" filter="$2"
  if [[ "$HAS_JQ" == "1" ]]; then
    printf '%s' "$json" | jq -r "$filter"
  else
    printf '%s\n' "$json"
  fi
}

api() {
  curl "${CURL_ARGS[@]}" "${BASE_URL}$1"
}

section() {
  printf '\n=== %s ===\n' "$1"
}

section "1. 按下载量取前 5 个 Skill"
LIST_JSON="$(api '/api/skills?sortBy=downloads&order=desc&pageSize=5')"
show "$LIST_JSON" '.data.skills[] | "\(.slug)\t下载 \(.downloads)\t\(.name)"'

# 命令行传了 slug 就用它，否则用示例 Skill
SLUG="${1:-$DEMO_SLUG}"
echo "使用 slug：$SLUG"

section "2. Skill 详情"
show "$(api "/api/v1/skills/${SLUG}")" \
  '"名称：\(.skill.displayName)\n分类：\(.skill.category)\n最新版本：\(.latestVersion.version // "-")\n作者：\(.owner.handle // "-")"'

section "3. 版本列表"
VERSIONS_JSON="$(api "/api/v1/skills/${SLUG}/versions")"
show "$VERSIONS_JSON" '.versions[] | "\(.version)\t\(.changelog // "-")"'

if [[ "$HAS_JQ" == "1" ]]; then
  VERSION="$(printf '%s' "$VERSIONS_JSON" | jq -r '.versions[0].version // empty')"
else
  VERSION=""
fi

section "4. 文件列表"
if [[ -n "$VERSION" ]]; then
  FILES_PATH="/api/v1/skills/${SLUG}/files?version=${VERSION}"
else
  FILES_PATH="/api/v1/skills/${SLUG}/files"
fi
show "$(api "$FILES_PATH")" '.files[] | "\(.size)\t\(.path)"'

section "5. 质量结果"
# 尚未评估的 Skill 会返回 404，这是正常状态
if EVAL_JSON="$(api "/api/v1/skills/${SLUG}/evaluation" 2>/dev/null)"; then
  show "$EVAL_JSON" '
    (.dimensions | to_entries[] | "\(.key)\t\(
      [.value.items[].score | select(. != null)] as $s
      | if ($s | length) > 0 then (($s | add) / ($s | length) * 10 | round / 10 | tostring) else "-" end
    )"),
    "小结：\(.userSummary // "-")"'
else
  echo "该 Skill 暂无质量评估结果（接口返回 404，属正常情况）"
fi

section "6. 下载地址"
# 下载接口返回 302，这里只取 Location，不实际下载文件
DL_URL="$(curl "${CURL_ARGS[@]}" -o /dev/null -w '%{redirect_url}' \
  "${BASE_URL}/api/v1/download?slug=${SLUG}")"
if [[ -n "$DL_URL" ]]; then
  echo "302 跳转到：${DL_URL%%\?*}"
  echo "（实际下载：curl -L -o ${SLUG}.zip \"\$BASE_URL/api/v1/download?slug=${SLUG}\"）"
else
  echo "未取到下载地址"
fi

printf '\n完成。更多接口见 docs/api/README.md\n'
