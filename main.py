import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from api_documentation import DESCRIPTION, TAGS, VALIDATION_RESPONSE
from apis import cart, payments, products
from app_logging import configure_logging, log_http_exception, log_validation_error
from catalog_query import ProductQueryCleanupMiddleware
from models import RootResponse
from web import ArkanoidSite, SinglePageApp

BASE_DIR = Path(__file__).resolve().parent
API_PREFIX = "/api"

configure_logging()

# The store API. Served under /api; the original root paths stay available as legacy aliases (see web.py).
api = FastAPI(
    title="Arkanoid",
    description=DESCRIPTION,
    version="1.0.0",
    openapi_tags=TAGS,
    servers=[{"url": API_PREFIX, "description": "Prefijo de la API en el mismo origen donde se sirve este esquema."}],
    responses=VALIDATION_RESPONSE,
)
api.add_middleware(ProductQueryCleanupMiddleware)
api.add_exception_handler(StarletteHTTPException, log_http_exception)
api.add_exception_handler(RequestValidationError, log_validation_error)


def flatten_optional_parameters(schema: dict) -> dict:
    """Publica los parámetros opcionales como `{type, enum}` en vez de `anyOf: [tipo, null]`.

    Muchos importadores de herramientas para agentes toman solo la primera rama de `anyOf` y descartan
    el `enum` hermano; `required: false` ya expresa que el parámetro es opcional.
    """
    for operations in schema["paths"].values():
        for operation in operations.values():
            for parameter in operation.get("parameters", []):
                param_schema = parameter["schema"]
                branches = param_schema.get("anyOf", [])
                non_null = [branch for branch in branches if branch.get("type") != "null"]
                if len(branches) == 2 and len(non_null) == 1:
                    del param_schema["anyOf"]
                    parameter["schema"] = {**non_null[0], **param_schema}
    return schema


def custom_openapi() -> dict:
    return flatten_optional_parameters(FastAPI.openapi(api))


api.openapi = custom_openapi

# Include routers from the apis module
api.include_router(products.router, tags=["Productos"])
api.include_router(cart.router, tags=["Carrito"])
api.include_router(payments.router, tags=["Pagos"])
api.mount("/images", StaticFiles(directory=BASE_DIR / "static"), name="images")


@api.get("/", response_model=RootResponse, include_in_schema=False)
async def read_root(request: Request) -> RootResponse:
    """Da la bienvenida y muestra la ubicación del esquema OpenAPI."""
    root_path = request.scope.get("root_path", "").rstrip("/")
    return RootResponse(
        message="Bienvenido a Arkanoid, tu tienda de videojuegos. "
        "Consulta consolas, videojuegos y accesorios y compra en pesos mexicanos. "
        "El esquema OpenAPI está disponible en /openapi.json.",
        openapi_url=f"{root_path}/openapi.json",
    )


def frontend_dist() -> Path:
    """Directory with the built React storefront (`pnpm build` in frontend/)."""
    return Path(os.environ.get("ARKANOID_FRONTEND_DIST", BASE_DIR / "frontend" / "dist"))


def create_site(frontend_dir: Path | None) -> ArkanoidSite:
    """Serves the storefront at / and the API at /api. Without a built storefront, / falls back to the API."""
    frontend = SinglePageApp(frontend_dir) if frontend_dir and (frontend_dir / "index.html").is_file() else None
    return ArkanoidSite(api=api, frontend=frontend, api_prefix=API_PREFIX)


# ASGI entry point used by uvicorn (`uvicorn main:app`).
app = create_site(frontend_dist())
