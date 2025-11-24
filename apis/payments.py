from fastapi import APIRouter, HTTPException, Body
from data import CARTS, PRODUCTS
from models import PaymentRequest
import uuid

router = APIRouter()

@router.post("/payments/{user_id}")
async def process_payment(user_id: str, payment: PaymentRequest):
    """
    "Process" a payment for the user's cart.
    This validates the PIN (must be the last 4 digits of the card)
    and clears the cart upon success.
    Returns a full receipt of the transaction.
    """
    if user_id not in CARTS or not CARTS[user_id]:
        raise HTTPException(status_code=400, detail="Cart is empty or does not exist")

    card_number = payment.credit_card_number.replace(" ", "")
    if not card_number.isdigit() or len(card_number) < 4:
        raise HTTPException(status_code=400, detail="Invalid credit card number format")

    expected_pin = card_number[-4:]
    if payment.pin != expected_pin:
        raise HTTPException(status_code=400, detail="Invalid PIN")

    # --- Start building the receipt ---
    
    # 1. Get cart contents and calculate total cost
    purchased_items = []
    total_cost = 0
    
    cart_before_payment = CARTS[user_id].copy()

    for item in cart_before_payment:
        product = next((p for p in PRODUCTS if p['id'] == item['productId']), None)
        if product:
            item_total_price = product['price'] * item['quantity']
            total_cost += item_total_price
            purchased_items.append({
                "productId": product['id'],
                "name": product['name'],
                "unitPrice": product['price'],
                "quantity": item['quantity'],
                "totalPrice": round(item_total_price, 2)
            })

    # "Payment processed" - clear the cart
    CARTS[user_id] = []

    # 2. Mask card number
    masked_card_number = f"**** **** **** {card_number[-4:]}"

    # 3. Generate ticket ID
    ticket_id = f"TICKET-{uuid.uuid4()}"
    
    # 4. Assemble the full response
    return {
        "status": "success",
        "message": "Payment processed successfully.",
        "ticketId": ticket_id,
        "paymentSummary": {
            "totalAmount": round(total_cost, 2),
            "paymentMethod": {
                "card": masked_card_number,
            }
        },
        "purchasedItems": purchased_items
    }
