from fastapi import FastAPI

from apis import cart, payments, products

app = FastAPI(
    title="Ecommerce Simulation API",
    description="A simple API to simulate an ecommerce backend with products, carts, and payments.",
    version="1.0.0",
)

# Include routers from the apis module
app.include_router(products.router, tags=["Products"])
app.include_router(cart.router, tags=["Cart"])
app.include_router(payments.router, tags=["Payments"])


@app.get("/", include_in_schema=False)
async def read_root():
    return {"message": "Welcome to the Ecommerce Simulation API!"}
