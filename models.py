from pydantic import BaseModel, Field
from typing import List, Dict

class ProductAttributes(BaseModel):
    size: str
    color: str
    category: str

class Product(BaseModel):
    id: str
    name: str
    description: str
    price: float
    attributes: ProductAttributes

class CartItem(BaseModel):
    product_id: str = Field(..., alias="productId")
    quantity: int

class CartItemUpdate(BaseModel):
    quantity: int

class PaymentRequest(BaseModel):
    credit_card_number: str = Field(..., alias="creditCardNumber")
    pin: str
