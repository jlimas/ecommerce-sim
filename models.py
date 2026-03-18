from typing import List

from pydantic import BaseModel, ConfigDict, Field


class ProductAttributes(BaseModel):
    size: str = Field(..., description="Size of the product (e.g. XS, S, M, L, XL)")
    color: str = Field(..., description="Color of the product (e.g. Red, Blue, Green)")
    category: str = Field(..., description="Product category (e.g. Apparel, Accessories, Footwear)")


class Product(BaseModel):
    id: str = Field(..., description="Unique product identifier")
    name: str = Field(..., description="Product name")
    description: str = Field(..., description="Product description")
    price: float = Field(..., description="Product price in USD")
    attributes: ProductAttributes


class CartItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: str = Field(..., alias="productId", description="The product ID to add to the cart")
    quantity: int = Field(..., gt=0, description="Number of units")


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., description="New quantity for the cart item. Set to 0 or below to remove.")


class PaymentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    credit_card_number: str = Field(
        ...,
        alias="creditCardNumber",
        description="Credit card number (digits only, min 4 chars). For simulation, PIN must equal the last 4 digits.",
        examples=["1234567890001234"],
    )
    pin: str = Field(
        ...,
        description="4-digit PIN. Must match the last 4 digits of the credit card number.",
        examples=["1234"],
    )


# --- Payment response models ---


class PaymentMethod(BaseModel):
    card: str = Field(..., description="Masked credit card number", examples=["**** **** **** 1234"])


class PaymentSummary(BaseModel):
    total_amount: float = Field(..., alias="totalAmount", description="Total amount charged")
    payment_method: PaymentMethod = Field(..., alias="paymentMethod")

    model_config = ConfigDict(populate_by_name=True)


class PurchasedItem(BaseModel):
    product_id: str = Field(..., alias="productId", description="Product ID")
    name: str = Field(..., description="Product name")
    unit_price: float = Field(..., alias="unitPrice", description="Price per unit")
    quantity: int = Field(..., description="Units purchased")
    total_price: float = Field(..., alias="totalPrice", description="Total price for this line item")

    model_config = ConfigDict(populate_by_name=True)


class PaymentReceipt(BaseModel):
    status: str = Field(..., description="Payment status", examples=["success"])
    message: str = Field(..., description="Human-readable result message")
    ticket_id: str = Field(..., alias="ticketId", description="Unique transaction ticket ID")
    payment_summary: PaymentSummary = Field(..., alias="paymentSummary")
    purchased_items: List[PurchasedItem] = Field(..., alias="purchasedItems")

    model_config = ConfigDict(populate_by_name=True)
