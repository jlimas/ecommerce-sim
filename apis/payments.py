import uuid
from decimal import Decimal

from fastapi import APIRouter, Body, HTTPException

from api_documentation import RECEIPT_EXAMPLE, UserId, error_response, success_response
from data import CARTS, PRODUCTS
from models import PaymentReceipt, PaymentRequest

router = APIRouter()


@router.post(
    "/payments/{user_id}",
    response_model=PaymentReceipt,
    summary="Pagar carrito",
    operation_id="payCart",
    responses={
        **success_response("Pago aprobado: recibo completo en MXN y carrito vacío.", compraDeDosPiezas=RECEIPT_EXAMPLE),
        **error_response(
            400,
            "Pago no aprobado. No se vacía el carrito. Corrige detail antes de reintentar; "
            "no uses datos bancarios reales.",
            carritoVacio="El carrito está vacío o no existe",
            tarjetaNoValida="Formato de tarjeta no válido",
            pinIncorrecto="PIN de prueba no válido",
        ),
    },
)
async def process_payment(
    user_id: UserId,
    payment: PaymentRequest = Body(
        ...,
        openapi_examples={
            "pagoAprobado": {
                "summary": "Tarjeta ficticia y PIN coincidente: aprueba si el carrito tiene productos",
                "value": {"creditCardNumber": "1111222233334444", "pin": "4444"},
            },
            "cerosIniciales": {
                "summary": "El PIN es texto: conserva los ceros iniciales",
                "value": {"creditCardNumber": "1111222233330042", "pin": "0042"},
            },
            "pinIncorrecto": {
                "summary": "Ejemplo que devuelve HTTP 400 sin vaciar un carrito con productos",
                "value": {"creditCardNumber": "1111222233334444", "pin": "0000"},
            },
        },
    ),
) -> dict:
    """
    Paga el carrito y recibe un ticket con todos los importes en pesos mexicanos (MXN).

    ## Pasarela de pago y PIN de prueba

    Este endpoint utiliza una pasarela de pago de prueba (mock): **no realiza cargos reales**.
    No envíes tarjetas ni NIP bancarios reales. El campo pin no es un NIP bancario, CVV, contraseña
    de usuario ni código enviado por SMS: es una regla de validación de esta pasarela.

    **Cómo calcular el PIN:** toma creditCardNumber como texto, elimina sus espacios y copia
    sus últimos cuatro dígitos, sin modificarlos. Envía esos cuatro dígitos como el string pin.
    El número ficticio debe contener al menos cuatro dígitos; no se validan vencimiento ni CVV.
    La API no solicita nombre de titular, fecha de expiración, cuenta bancaria ni otros secretos.

    | Tarjeta ficticia (string) | PIN (string) | Resultado con carrito no vacío |
    | --- | --- | --- |
    | `1111222233334444` | `4444` | HTTP 200, recibo en MXN y carrito vacío |
    | `1111 2222 3333 4444` | `4444` | HTTP 200; se permiten espacios en el número |
    | `1111222233330042` | `0042` | HTTP 200; conserva ceros iniciales |
    | `1111222233334444` | `0000` | HTTP 400, `PIN de prueba no válido`; el carrito no cambia |

    Ejemplo de solicitud funcional (agrega productos al carrito del mismo user_id primero):

    ```json
    {"creditCardNumber": "1111222233334444", "pin": "4444"}
    ```

    Envía ambos campos como strings JSON: `"4444"`, no el número `4444`.
    Si integras un agente, puede utilizar el par ficticio anterior para esta pasarela;
    no necesita solicitar un NIP bancario real al cliente.

    ## Recorrido completo

    1. Agrega productos con addToCart y revisa el carrito con getCart usando el mismo user_id.
    2. Resuelve sus productId con getProduct y revisa cantidades y total en MXN con el cliente.
    3. Envía la tarjeta ficticia y su PIN coincidente en esta operación.
    4. Con HTTP 200, conserva ticketId, paymentSummary y purchasedItems. Todos los importes son MXN.
       El número de tarjeta se devuelve enmascarado y el PIN no aparece en el recibo.
    5. El carrito queda vacío. Para una nueva compra, agrega nuevos productos.

    ## Errores y reintentos

    Se valida primero que el carrito tenga productos, después el formato de tarjeta y por último el PIN.
    Si el carrito está vacío, recibirás `El carrito está vacío o no existe` aunque el PIN también esté mal.
    Un error 400 o 422 no elimina los productos del carrito.
    No hay idempotencia ni consulta posterior de tickets: ante un timeout no repitas automáticamente
    el pago ni vuelvas a llenar el carrito para intentar cobrar otra vez. Un carrito vacío por sí solo
    no confirma la compra; conserva el recibo solamente cuando lo recibas del servidor.
    """
    if user_id not in CARTS or not CARTS[user_id]:
        raise HTTPException(status_code=400, detail="El carrito está vacío o no existe")

    card_number = payment.credit_card_number.replace(" ", "")
    if not card_number.isdigit() or len(card_number) < 4:
        raise HTTPException(status_code=400, detail="Formato de tarjeta no válido")

    expected_pin = card_number[-4:]
    if payment.pin != expected_pin:
        raise HTTPException(status_code=400, detail="PIN de prueba no válido")

    # --- Start building the receipt ---

    # 1. Get cart contents and calculate total cost
    purchased_items = []
    total_cost = Decimal("0.00")

    cart_before_payment = CARTS[user_id].copy()

    for item in cart_before_payment:
        product = next((p for p in PRODUCTS if p["id"] == item["productId"]), None)
        if product:
            item_total_price = Decimal(str(product["price"])) * item["quantity"]
            total_cost += item_total_price
            purchased_items.append(
                {
                    "productId": product["id"],
                    "name": product["name"],
                    "unitPrice": product["price"],
                    "quantity": item["quantity"],
                    "totalPrice": float(item_total_price),
                }
            )

    # Vaciar el carrito después de aprobar el pago.
    CARTS[user_id] = []

    # 2. Mask card number
    masked_card_number = f"**** **** **** {card_number[-4:]}"

    # 3. Generate ticket ID
    ticket_id = f"TICKET-{uuid.uuid4()}"

    # 4. Assemble the full response
    return {
        "status": "success",
        "message": "Pago procesado correctamente.",
        "ticketId": ticket_id,
        "paymentSummary": {
            "totalAmount": float(total_cost),
            "currency": "MXN",
            "paymentMethod": {
                "card": masked_card_number,
            },
        },
        "purchasedItems": purchased_items,
    }
