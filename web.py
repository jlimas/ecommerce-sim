"""Composición del sitio: la tienda en React en `/` y la API en `/api`.

Las rutas originales de la API en la raíz (`/products`, `/cart`, ...) siguen respondiendo como alias
para no romper a los clientes que ya las usan.
"""

import html
import json
from collections.abc import Callable
from pathlib import Path

from starlette.responses import FileResponse, HTMLResponse, JSONResponse, Response
from starlette.types import ASGIApp, Receive, Scope, Send

# Root paths the API served before moving under /api. Kept as aliases so existing integrations keep working.
LEGACY_API_PATHS = ("/products", "/cart", "/payments", "/images", "/openapi.json", "/docs", "/redoc")

IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
ROOT_MARKER = '<div id="root"></div>'
HTTP_METHODS = ("get", "post", "put", "patch", "delete")


def _matches(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(prefix + "/")


def _wants_html(scope: Scope) -> bool:
    """True for browser navigations (Accept includes text/html); API clients send */* or application/json."""
    accept = dict(scope.get("headers", [])).get(b"accept", b"").decode("latin-1")
    return "text/html" in accept


def render_api_page(schema: dict) -> str:
    """Static HTML of the API reference, pre-rendered inside #root so scrapers without JavaScript can read it.

    React replaces it on load with the interactive page at the same route.
    """
    base = (schema.get("servers") or [{"url": ""}])[0]["url"].rstrip("/")
    esc = html.escape
    endpoints = []
    for path, operations in schema.get("paths", {}).items():
        for method in HTTP_METHODS:
            operation = operations.get(method)
            if operation is None:
                continue
            summary = esc(operation.get("summary", ""))
            operation_id = esc(operation.get("operationId", ""))
            endpoints.append(
                f"<li><code>{method.upper()} {esc(base + path)}</code> {summary}"
                + (f" <small>(operationId: {operation_id})</small>" if operation_id else "")
                + "</li>"
            )
    spec_json = esc(json.dumps(schema, ensure_ascii=False, indent=2), quote=False)
    info = schema.get("info", {})
    return (
        '<main id="api-reference">'
        f"<h1>API de {esc(info.get('title', 'Arkanoid'))}</h1>"
        f"<p>URL base: <code>{esc(base or '/')}</code> · versión {esc(str(info.get('version', '')))}</p>"
        f'<p>Esquema OpenAPI: <a href="{esc(base)}/openapi.json">{esc(base)}/openapi.json</a> · '
        f'Documentación interactiva: <a href="{esc(base)}/docs">{esc(base)}/docs</a></p>'
        f"<h2>Endpoints</h2><ul>{''.join(endpoints)}</ul>"
        f'<h2>Especificación OpenAPI</h2><pre id="openapi-spec">{spec_json}</pre>'
        "</main>"
    )


class ArkanoidSite:
    """Routes `/api/*` to the API (with `root_path=/api`), legacy root API paths to the API unchanged,
    and everything else to the storefront. Without a storefront build, every request goes to the API."""

    def __init__(
        self,
        api: ASGIApp,
        frontend: "SinglePageApp | None",
        api_prefix: str = "/api",
        api_page: Callable[[], str] | None = None,
    ) -> None:
        self.api = api
        self.frontend = frontend
        self.api_prefix = api_prefix
        # Pre-rendered HTML for the storefront's API page, built lazily once (the schema is static).
        self._api_page = api_page
        self._api_page_html: str | None = None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.api(scope, receive, send)  # lifespan belongs to the API
            return

        path: str = scope["path"]
        if self._is_api_page_request(scope):
            # Same URL, two audiences: browsers get the storefront's API page, API clients keep the JSON welcome.
            await self.frontend.index_response(self._api_page_content())(scope, receive, send)
        elif _matches(path, self.api_prefix):
            if path == self.api_prefix:
                path = self.api_prefix + "/"
            # Starlette resolves routes from `path` minus `root_path`, so the full path stays intact.
            scope = {**scope, "path": path, "root_path": scope.get("root_path", "") + self.api_prefix}
            await self.api(scope, receive, send)
        elif self.frontend is None or any(_matches(path, legacy) for legacy in LEGACY_API_PATHS):
            await self.api(scope, receive, send)
        else:
            await self.frontend(scope, receive, send)

    def _is_api_page_request(self, scope: Scope) -> bool:
        return (
            self.frontend is not None
            and scope["type"] == "http"
            and scope["method"] in ("GET", "HEAD")
            and scope["path"] in (self.api_prefix, self.api_prefix + "/")
            and _wants_html(scope)
        )

    def _api_page_content(self) -> str | None:
        if self._api_page is None:
            return None
        if self._api_page_html is None:
            self._api_page_html = self._api_page()
        return self._api_page_html


class SinglePageApp:
    """Serves the built React app: real files when they exist, `index.html` for client-side routes."""

    def __init__(self, directory: Path) -> None:
        self.directory = directory.resolve()
        self.index = self.directory / "index.html"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        response = self.response_for(scope)
        await response(scope, receive, send)

    def response_for(self, scope: Scope) -> Response:
        if scope["method"] not in ("GET", "HEAD"):
            return JSONResponse({"detail": "Método no permitido"}, status_code=405, headers={"Allow": "GET, HEAD"})

        path: str = scope["path"]
        candidate = (self.directory / path.lstrip("/")).resolve()
        if candidate.is_relative_to(self.directory) and candidate.is_file():
            cache = IMMUTABLE_CACHE if candidate.parent.name == "assets" else "public, max-age=3600"
            return FileResponse(candidate, headers={"Cache-Control": cache})

        # A missing file (e.g. an old hashed asset) must not be answered with HTML.
        if "." in path.rsplit("/", 1)[-1]:
            return JSONResponse({"detail": "Archivo no encontrado"}, status_code=404)

        return self.index_response()

    def index_response(self, prerendered: str | None = None) -> Response:
        """`index.html`, optionally with static HTML inside #root for crawlers (React replaces it on load)."""
        if prerendered is None:
            return FileResponse(self.index, headers={"Cache-Control": "no-cache"})
        page = self.index.read_text(encoding="utf-8")
        if ROOT_MARKER not in page:
            return FileResponse(self.index, headers={"Cache-Control": "no-cache"})
        page = page.replace(ROOT_MARKER, f'<div id="root">{prerendered}</div>', 1)
        return HTMLResponse(page, headers={"Cache-Control": "no-cache"})
