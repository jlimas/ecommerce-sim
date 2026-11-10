from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from api_documentation import DESCRIPTION, TAGS, VALIDATION_RESPONSE
from apis import cart, payments, products
from app_logging import configure_logging, log_http_exception, log_validation_error
from catalog_query import ProductQueryCleanupMiddleware
from models import RootResponse

configure_logging()

app = FastAPI(
    title="Arkanoid",
    description=DESCRIPTION,
    version="1.0.0",
    openapi_tags=TAGS,
    servers=[{"url": "/", "description": "Usa el mismo origen donde se sirve este esquema OpenAPI."}],
    responses=VALIDATION_RESPONSE,
)
app.add_middleware(ProductQueryCleanupMiddleware)
app.add_exception_handler(StarletteHTTPException, log_http_exception)
app.add_exception_handler(RequestValidationError, log_validation_error)


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
    return flatten_optional_parameters(FastAPI.openapi(app))


app.openapi = custom_openapi

# Include routers from the apis module
app.include_router(products.router, tags=["Productos"])
app.include_router(cart.router, tags=["Carrito"])
app.include_router(payments.router, tags=["Pagos"])
app.mount("/images", StaticFiles(directory=Path(__file__).resolve().parent / "static"), name="images")


@app.get("/", response_model=RootResponse, include_in_schema=False)
async def read_root() -> RootResponse:
    """Da la bienvenida y muestra la ubicación del esquema OpenAPI."""
    return RootResponse(
        message="Bienvenido a Arkanoid, tu tienda de videojuegos. "
        "Consulta consolas, videojuegos y accesorios y compra en pesos mexicanos. "
        "El esquema OpenAPI está disponible en /openapi.json.",
        openapi_url="/openapi.json",
    )
