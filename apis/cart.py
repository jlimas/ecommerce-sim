from typing import List

from fastapi import APIRouter, HTTPException

from data import CARTS, PRODUCTS
from models import CartItem, CartItemUpdate

router = APIRouter()


@router.get("/cart/{user_id}", response_model=List[CartItem])
async def get_cart(user_id: str):
    """
    View the contents of a specific user's cart.
    """
    if user_id not in CARTS:
        CARTS[user_id] = []
    return CARTS[user_id]


@router.post("/cart/{user_id}", response_model=List[CartItem])
async def add_to_cart(user_id: str, item: CartItem):
    """
    Add a product to the cart. If the item already exists, its quantity is increased.
    """
    if user_id not in CARTS:
        CARTS[user_id] = []

    # Check if product exists
    product = next((p for p in PRODUCTS if p["id"] == item.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing_item = next((i for i in CARTS[user_id] if i["productId"] == item.product_id), None)

    if existing_item:
        existing_item["quantity"] += item.quantity
    else:
        CARTS[user_id].append(item.dict(by_alias=True))

    return CARTS[user_id]


@router.put("/cart/{user_id}/{product_id}", response_model=List[CartItem])
async def update_cart_item(user_id: str, product_id: str, update: CartItemUpdate):
    """
    Update the quantity of a product in the cart.
    """
    if user_id not in CARTS:
        raise HTTPException(status_code=404, detail="Cart not found for user")

    item = next((i for i in CARTS[user_id] if i["productId"] == product_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in cart")

    item["quantity"] = update.quantity
    if item["quantity"] <= 0:
        CARTS[user_id] = [i for i in CARTS[user_id] if i["productId"] != product_id]

    return CARTS[user_id]


@router.delete("/cart/{user_id}/{product_id}", response_model=List[CartItem])
async def remove_from_cart(user_id: str, product_id: str):
    """
    Remove a product from the cart.
    """
    if user_id not in CARTS:
        raise HTTPException(status_code=404, detail="Cart not found for user")

    original_cart_size = len(CARTS[user_id])
    CARTS[user_id] = [i for i in CARTS[user_id] if i["productId"] != product_id]

    if len(CARTS[user_id]) == original_cart_size:
        raise HTTPException(status_code=404, detail="Item not found in cart")

    return CARTS[user_id]
