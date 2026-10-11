"""
SPA 静态资源兜底路由的行为测试

背景：前端的 SPA 兜底路由（`/{full_path:path}`）会吞掉**所有**未匹配的
路径。早期实现把它无条件指向 index.html，于是当某个功能的开关没开、
路由未注册时，`/api/xxx` 会返回 HTML 而不是 JSON：

    前端 fetch -> 得到 "<!doctype html>..." -> JSON.parse 抛
    「Unexpected token '<', "<!doctype "... is not valid JSON」

用户看到的就是这句毫无意义的解析错误，完全不知道真实原因是
「功能开关没开」。因此 /api/* 必须返回结构化 JSON 错误。

注意两种部署形态下 SPA 兜底的行为差异：
  - 有前端产物（frontend/dist 存在）：兜底路由已注册，SPA 路由返回 HTML；
  - 无前端产物（CI / 纯后端 / 忘了 npm run build）：该路由**根本不注册**，
    此时 SPA 路径返回 404 才是正确行为。
frontend/dist 在 .gitignore 里，CI 上必然不存在，因此下面的 SPA 路由
用例必须显式声明「需要前端产物」这一前置条件，而不是碰运气。
"""

import pytest

from main import _HAS_FRONTEND

requires_frontend = pytest.mark.skipif(
    not _HAS_FRONTEND,
    reason="需要先构建前端（frontend/dist 不存在，SPA 兜底路由未注册）",
)


def test_unknown_api_path_returns_json_not_html(client):
    """未注册的 /api 路径必须返回 JSON 错误，而不是 index.html"""
    resp = client.get("/api/definitely-not-a-real-endpoint")

    assert resp.status_code == 404
    # 关键：不能是 text/html，否则前端 JSON.parse 会报解析错误
    assert "application/json" in resp.headers.get("content-type", "")

    body = resp.json()
    assert "detail" in body
    # 提示要指向「开关未开启」这个最常见原因
    assert "开关" in body["detail"]


def test_disabled_feature_api_returns_json(client):
    """功能未启用时（路由未注册），接口也应返回 JSON 提示"""
    resp = client.get("/api/not-enabled-feature/info")

    assert resp.status_code == 404
    assert "application/json" in resp.headers.get("content-type", "")
    assert "开关" in resp.json()["detail"]


@requires_frontend
def test_spa_routes_still_serve_html(client):
    """普通前端路由仍要回退到 index.html（不能被上面的改动影响）

    前置条件：必须先构建前端。没有 index.html 时兜底路由不会注册，
    该断言本身就不成立（见文件头说明）。
    """
    resp = client.get("/some/spa/route")

    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")


def test_spa_fallback_absent_without_frontend(client):
    """没有前端产物时，SPA 路径返回 404 是预期行为（而非 500/HTML）

    这条用例在 CI（无 dist）上跑，用来钉住「无前端产物」这一形态的
    行为，避免上面那条被 skip 后完全没人覆盖。
    """
    if _HAS_FRONTEND:
        pytest.skip("本地已构建前端，兜底路由存在，不适用该断言")

    resp = client.get("/some/spa/route")
    assert resp.status_code == 404
    # 即便兜底不存在，也绝不能返回 HTML 让前端调用方误解
    assert "text/html" not in resp.headers.get("content-type", "")
