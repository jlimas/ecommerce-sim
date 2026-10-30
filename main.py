from fastapi import FastAPI

from apis import cart, payments, products
from models import RootResponse

app = FastAPI(
    title="Ecommerce Simulation API",
    description="A simple API to simulate an ecommerce backend with products, carts, and payments.",
    version="1.0.0",
)

# Include routers from the apis module
app.include_router(products.router, tags=["Products"])
app.include_router(cart.router, tags=["Cart"])
app.include_router(payments.router, tags=["Payments"])


@app.get("/", response_model=RootResponse, include_in_schema=False)
async def read_root() -> RootResponse:
    """Welcome users and point them to the OpenAPI schema."""
    return RootResponse(
        message="Welcome to the Ecommerce Simulation API! An OpenAPI schema is available at /openapi.json.",
        openapi_url="/openapi.json",
    )
