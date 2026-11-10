from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from api_documentation import DESCRIPTION, TAGS, VALIDATION_RESPONSE
from apis import cart, payments, products
from models import RootResponse

app = FastAPI(
    title="Arkanoid",
    description=DESCRIPTION,
    version="1.0.0",
    openapi_tags=TAGS,
    servers=[{"url": "/", "description": "Usa el mismo origen donde se sirve este esquema OpenAPI."}],
    responses=VALIDATION_RESPONSE,
)

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
