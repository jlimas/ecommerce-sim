"""Composición del sitio: la tienda en React en `/` y la API en `/api`.

Las rutas originales de la API en la raíz (`/products`, `/cart`, ...) siguen respondiendo como alias
para no romper a los clientes que ya las usan.
"""

from pathlib import Path

from starlette.responses import FileResponse, JSONResponse, Response
from starlette.types import ASGIApp, Receive, Scope, Send

# Root paths the API served before moving under /api. Kept as aliases so existing integrations keep working.
LEGACY_API_PATHS = ("/products", "/cart", "/payments", "/images", "/openapi.json", "/docs", "/redoc")

IMMUTABLE_CACHE = "public, max-age=31536000, immutable"


def _matches(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(prefix + "/")


class ArkanoidSite:
    """Routes `/api/*` to the API (with `root_path=/api`), legacy root API paths to the API unchanged,
    and everything else to the storefront. Without a storefront build, every request goes to the API."""

    def __init__(self, api: ASGIApp, frontend: ASGIApp | None, api_prefix: str = "/api") -> None:
        self.api = api
        self.frontend = frontend
        self.api_prefix = api_prefix

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.api(scope, receive, send)  # lifespan belongs to the API
            return

        path: str = scope["path"]
        if _matches(path, self.api_prefix):
            if path == self.api_prefix:
                path = self.api_prefix + "/"
            # Starlette resolves routes from `path` minus `root_path`, so the full path stays intact.
            scope = {**scope, "path": path, "root_path": scope.get("root_path", "") + self.api_prefix}
            await self.api(scope, receive, send)
        elif self.frontend is None or any(_matches(path, legacy) for legacy in LEGACY_API_PATHS):
            await self.api(scope, receive, send)
        else:
            await self.frontend(scope, receive, send)


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

        return FileResponse(self.index, headers={"Cache-Control": "no-cache"})
