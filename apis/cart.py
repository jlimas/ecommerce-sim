from typing import List

from fastapi import APIRouter, Body, HTTPException

from api_documentation import (
    CART_EXAMPLE,
    CART_NOT_FOUND,
    PRODUCT_NOT_FOUND,
    ProductId,
    UserId,
    success_response,
)
from app_logging import log_event
from data import CARTS, PRODUCTS
from models import CartItem, CartItemUpdate

router = APIRouter()


@router.get(
    "/cart/{user_id}",
    response_model=List[CartItem],
    summary="Consultar carrito",
    operation_id="getCart",
    responses=success_response("Carrito actual del cliente.", conProductos=CART_EXAMPLE, vacio=[]),
)
async def get_cart(user_id: UserId) -> list[dict]:
    """
    Consulta los productos y cantidades del carrito de un cliente.

    Si no existe, inicializa un carrito vacío y devuelve []. Cada partida contiene solamente
    productId y quantity: consulta getProduct para conocer precios, nombres y plataformas.
    Usa esta operación antes de modificar cantidades y para reconciliar respuestas perdidas de addToCart.
    El user_id lo generas tú: cualquier texto no vacío sin datos personales, como cliente-7f3a9c.
    No requiere sesión, login ni registro; reutiliza el mismo valor durante toda la conversación.
    """
    if user_id not in CARTS:
        CARTS[user_id] = []
    log_event("getCart", userId=user_id, cart=CARTS[user_id])
    return CARTS[user_id]


@router.post(
    "/cart/{user_id}",
    response_model=List[CartItem],
    summary="Agregar al carrito",
    operation_id="addToCart",
    responses={
        **success_response("Carrito completo después de sumar las unidades solicitadas.", actualizado=CART_EXAMPLE),
        **PRODUCT_NOT_FOUND,
    },
)
async def add_to_cart(
    user_id: UserId,
    item: CartItem = Body(
        ...,
        openapi_examples={
            "dosPiezas": {
                "summary": "Sumar dos piezas de Star Fox para Nintendo Switch 2",
                "value": {"productId": "45467911", "quantity": 2},
            }
        },
    ),
) -> list[dict]:
    """
    Agrega un producto al carrito. Si ya existe, incrementa su cantidad.

    quantity cuenta piezas del producto y debe ser un entero mayor que cero.
    Si había una pieza y envías dos, quedan tres.
    Para dejar exactamente dos usa updateCartItem. El producto debe existir en el catálogo.
    No es idempotente: repetir la misma solicitud vuelve a sumar unidades.
    Si pierdes la respuesta, consulta getCart antes de reintentar.
    El user_id lo generas tú: cualquier texto no vacío sin datos personales, como cliente-7f3a9c.
    No requiere sesión, login ni registro; reutiliza el mismo valor durante toda la conversación.
    """
    if user_id not in CARTS:
        CARTS[user_id] = []

    # Check if product exists
    product = next((p for p in PRODUCTS if p["id"] == item.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    existing_item = next((i for i in CARTS[user_id] if i["productId"] == item.product_id), None)

    if existing_item:
        existing_item["quantity"] += item.quantity
    else:
        CARTS[user_id].append(item.model_dump(by_alias=True))

    log_event("addToCart", userId=user_id, productId=item.product_id, added=item.quantity, cart=CARTS[user_id])
    return CARTS[user_id]


@router.put(
    "/cart/{user_id}/{product_id}",
    response_model=List[CartItem],
    summary="Actualizar cantidad",
    operation_id="updateCartItem",
    responses={
        **success_response(
            "Carrito completo con la cantidad establecida o la partida eliminada.",
            cantidadDos=CART_EXAMPLE,
            eliminado=[],
        ),
        **CART_NOT_FOUND,
    },
)
async def update_cart_item(
    user_id: UserId,
    product_id: ProductId,
    update: CartItemUpdate = Body(
        ...,
        openapi_examples={
            "establecerDos": {"summary": "Dejar exactamente dos unidades", "value": {"quantity": 2}},
            "eliminar": {"summary": "Eliminar la partida", "value": {"quantity": 0}},
        },
    ),
) -> list[dict]:
    """
    Actualiza la cantidad de un producto. Un valor de 0 o menor lo elimina del carrito.

    La cantidad reemplaza el valor actual: no es una diferencia ni un incremento.
    La partida debe existir; para agregar un producto nuevo usa addToCart.
    Repetir un valor positivo mantiene esa cantidad si la partida aún existe.
    Si ya eliminaste la partida, una nueva modificación devuelve 404.
    """
    if user_id not in CARTS:
        raise HTTPException(status_code=404, detail="Carrito no encontrado para el cliente")

    item = next((i for i in CARTS[user_id] if i["productId"] == product_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Producto no encontrado en el carrito")

    item["quantity"] = update.quantity
    if item["quantity"] <= 0:
        CARTS[user_id] = [i for i in CARTS[user_id] if i["productId"] != product_id]

    log_event("updateCartItem", userId=user_id, productId=product_id, quantity=update.quantity, cart=CARTS[user_id])
    return CARTS[user_id]


@router.delete(
    "/cart/{user_id}/{product_id}",
    response_model=List[CartItem],
    summary="Eliminar del carrito",
    operation_id="removeFromCart",
    responses={
        **success_response("Carrito completo después de quitar la partida.", ultimoProductoEliminado=[]),
        **CART_NOT_FOUND,
    },
)
async def remove_from_cart(user_id: UserId, product_id: ProductId) -> list[dict]:
    """
    Elimina un producto del carrito.

    Elimina todas las unidades de la partida, sin cuerpo de solicitud. No vacía las demás partidas.
    Devuelve 200 con el carrito actualizado (no 204). Si la partida ya no existe, devuelve 404;
    getCart permite verificar el resultado de una eliminación cuya respuesta se perdió.
    """
    if user_id not in CARTS:
        raise HTTPException(status_code=404, detail="Carrito no encontrado para el cliente")

    original_cart_size = len(CARTS[user_id])
    CARTS[user_id] = [i for i in CARTS[user_id] if i["productId"] != product_id]

    if len(CARTS[user_id]) == original_cart_size:
        raise HTTPException(status_code=404, detail="Producto no encontrado en el carrito")

    log_event("removeFromCart", userId=user_id, productId=product_id, cart=CARTS[user_id])
    return CARTS[user_id]
