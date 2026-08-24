#!/usr/bin/env python3
"""SkillHub 公开 API 最小示例：列表 / 详情 / 批量详情

用法：
    python3 examples/python/list_skills.py

环境变量：
    SKILLHUB_BASE_URL  接口地址，默认 https://api.skillhub.cn
    SKILLHUB_API_KEY   团队标识 Key（可选）

依赖：Python 3.9+（仅用标准库）
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = os.environ.get("SKILLHUB_BASE_URL", "https://api.skillhub.cn")
API_KEY = os.environ.get("SKILLHUB_API_KEY")
TIMEOUT = 20
DEMO_SLUG = "find-skill-skillhub"


class ApiError(Exception):
    pass


def request(path: str, payload: dict = None) -> dict:
    headers = {"Accept": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY

    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(BASE_URL + path, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = json.loads(exc.read().decode("utf-8")).get("error", "")
        except (ValueError, OSError):
            pass  # 错误响应不是 JSON 时只报状态码
        raise ApiError(f"{path} 请求失败：{exc.code}{' ' + detail if detail else ''}") from exc
    except urllib.error.URLError as exc:
        raise ApiError(f"{path} 请求失败：{exc.reason}") from exc


def list_skills(page_size: int = 5, sort_by: str = "downloads", order: str = "desc") -> dict:
    """列表接口带一层 code/message/data 信封，这里直接返回 data。"""
    query = urllib.parse.urlencode({"pageSize": page_size, "sortBy": sort_by, "order": order})
    return request(f"/api/skills?{query}")["data"]


def get_skill(slug: str) -> dict:
    return request(f"/api/v1/skills/{urllib.parse.quote(slug)}")


def batch_get_skills(slugs: list) -> dict:
    return request("/api/v1/skills/batch", payload={"slugs": slugs})


def print_skills(skills: list) -> None:
    for s in skills:
        print(f"  {s['slug']:<32} 下载 {s['downloads']:>7}  {s['name']}")


def main() -> int:
    print(f"\n=== 下载量 Top 5（{BASE_URL}）===")
    data = list_skills()
    print(f"公开 Skill 总数：{data.get('total')}")
    print_skills(data.get("skills", []))

    print(f"\n=== 详情：{DEMO_SLUG} ===")
    detail = get_skill(DEMO_SLUG)
    skill = detail["skill"]
    stats = skill["stats"]
    print(f"  名称：{skill['displayName']}")
    print(f"  分类：{skill['category']}")
    print(f"  最新版本：{(detail.get('latestVersion') or {}).get('version', '-')}")
    print(f"  作者：{(detail.get('owner') or {}).get('handle', '-')}")
    print(f"  统计：下载 {stats['downloads']} / 收藏 {stats['stars']} / 安装 {stats['installs']}")

    print("\n=== 批量详情（含一个不存在的 slug）===")
    batch = batch_get_skills([DEMO_SLUG, "not-exist-skill"])
    for item in batch.get("items") or []:
        print(f"  命中：{item['skill']['slug']} — {item['skill']['displayName']}")
    print(f"  未命中：{', '.join(batch.get('missing') or []) or '无'}")

    print("\n完成。更多接口见 docs/api/README.md")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ApiError as exc:
        print(f"\n出错了：{exc}", file=sys.stderr)
        sys.exit(1)
