from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from data import PRODUCTS
from models import Product

router = APIRouter()

@router.get("/products", response_model=List[Product])
async def get_products(
    size: Optional[str] = None,
    color: Optional[str] = None,
    category: Optional[str] = None
):
    """
    Get a list of all products, with optional filtering by attributes.
    """
    filtered_products = PRODUCTS
    if size:
        filtered_products = [p for p in filtered_products if p['attributes']['size'].lower() == size.lower()]
    if color:
        filtered_products = [p for p in filtered_products if p['attributes']['color'].lower() == color.lower()]
    if category:
        filtered_products = [p for p in filtered_products if p['attributes']['category'].lower() == category.lower()]
    return filtered_products

@router.get("/products/search", response_model=List[Product])
async def search_products(q: str = Query(..., min_length=3)):
    """
    Search for products by a query string in their name or description.
    """
    search_results = [
        p for p in PRODUCTS
        if q.lower() in p['name'].lower() or q.lower() in p['description'].lower()
    ]
    return search_results

@router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    """
    Get a single product by its ID.
    """
    product = next((p for p in PRODUCTS if p['id'] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
