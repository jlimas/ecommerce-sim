from typing import Any, List, Literal

from pydantic import BaseModel, ConfigDict, Field


class RootResponse(BaseModel):
    message: str
    openapi_url: str = Field(alias="openapiUrl", description="Ruta del esquema OpenAPI")

    model_config = ConfigDict(populate_by_name=True)


class ErrorResponse(BaseModel):
    """Error de negocio: la operación solicitada no pudo completarse."""

    detail: str = Field(..., description="Motivo del error en español", examples=["Producto no encontrado"])


class ValidationIssue(BaseModel):
    """Detalle de un campo que no cumple el contrato de entrada."""

    model_config = ConfigDict(extra="allow")

    loc: list[str | int] = Field(
        ...,
        description="Ubicación del campo: body, query o path, seguida de su nombre",
        examples=[["body", "quantity"], ["query", "q"]],
    )
    msg: str = Field(..., description="Explicación de la validación; puede estar en inglés")
    type: str = Field(..., description="Código del error de validación", examples=["missing", "greater_than"])
    input: Any = Field(default=None, description="Valor rechazado, si el framework lo incluye")


class ValidationErrorResponse(BaseModel):
    """Uno o más errores de validación de la solicitud (HTTP 422)."""

    detail: list[ValidationIssue] = Field(..., description="Errores por corregir antes de reenviar la solicitud")


class ProductAttributes(BaseModel):
    """Atributos para distinguir presentaciones y aplicar filtros exactos al catálogo."""

    brand: str = Field(..., description="Marca del producto", examples=["Coca-Cola"])
    presentation: str = Field(..., description="Contenido o presentación del producto", examples=["600 ml"])
    category: str = Field(..., description="Categoría del producto", examples=["Bebidas"])


class Product(BaseModel):
    """Producto vendible por unidad; price representa pesos mexicanos, no centavos."""

    id: str = Field(..., description="Identificador único del producto", examples=["PRD_1"])
    name: str = Field(..., description="Nombre del producto", examples=["Coca-Cola Original 600 ml"])
    description: str = Field(
        ..., description="Descripción del producto", examples=["Refresco de cola en botella individual."]
    )
    price: float = Field(
        ..., ge=0, description="Precio por unidad en pesos mexicanos (MXN), no centavos", examples=[22.0]
    )
    currency: Literal["MXN"] = Field(default="MXN", description="Moneda de los precios: pesos mexicanos")
    attributes: ProductAttributes


class CartItem(BaseModel):
    """Partida del carrito. Consulta el producto para obtener nombre, presentación y precio."""

    model_config = ConfigDict(populate_by_name=True)

    product_id: str = Field(..., alias="productId", description="Identificador del producto", examples=["PRD_1"])
    quantity: int = Field(
        ..., gt=0, description="Unidades de esta presentación. En POST se suman a las existentes.", examples=[2]
    )


class CartItemUpdate(BaseModel):
    """Cantidad absoluta: no es un incremento ni una diferencia respecto al carrito actual."""

    quantity: int = Field(
        ...,
        description="Nueva cantidad absoluta. Un valor de 0 o menor elimina el producto del carrito.",
        examples=[3, 0],
    )


class PaymentRequest(BaseModel):
    """Credenciales ficticias de la pasarela de prueba; nunca envíes datos bancarios reales."""

    model_config = ConfigDict(populate_by_name=True)

    credit_card_number: str = Field(
        ...,
        alias="creditCardNumber",
        description="Número de tarjeta ficticio (mínimo 4 dígitos). "
        "La pasarela es de prueba; no envíes datos bancarios reales.",
        examples=["1111222233334444"],
    )
    pin: str = Field(
        ...,
        description="PIN de prueba de 4 dígitos: debe coincidir con los últimos 4 dígitos de la tarjeta ficticia. "
        "No uses un NIP bancario real.",
        examples=["4444"],
    )


class PaymentMethod(BaseModel):
    card: str = Field(..., description="Número de tarjeta enmascarado", examples=["**** **** **** 4444"])


class PaymentSummary(BaseModel):
    """Resumen de compra. currency aplica también a los importes de purchasedItems."""

    total_amount: float = Field(
        ..., alias="totalAmount", description="Suma de todas las partidas en pesos mexicanos (MXN)", examples=[44.0]
    )
    currency: Literal["MXN"] = Field(default="MXN", description="Moneda de todos los importes del recibo")
    payment_method: PaymentMethod = Field(..., alias="paymentMethod")

    model_config = ConfigDict(populate_by_name=True)


class PurchasedItem(BaseModel):
    """Partida del recibo: totalPrice = unitPrice × quantity, con importes en MXN."""

    product_id: str = Field(..., alias="productId", description="Identificador del producto")
    name: str = Field(..., description="Nombre del producto")
    unit_price: float = Field(..., alias="unitPrice", description="Precio por unidad en pesos mexicanos (MXN)")
    quantity: int = Field(..., description="Unidades compradas")
    total_price: float = Field(..., alias="totalPrice", description="Importe de la partida en pesos mexicanos (MXN)")

    model_config = ConfigDict(populate_by_name=True)


class PaymentReceipt(BaseModel):
    """Comprobante de la compra. Consérvalo: no existe una ruta para consultar recibos anteriores."""

    status: str = Field(..., description="Estado del pago", examples=["success"])
    message: str = Field(..., description="Mensaje con el resultado de la operación")
    ticket_id: str = Field(
        ...,
        alias="ticketId",
        description="Folio único del recibo. No es un productId ni permite consultar un pedido.",
        examples=["TICKET-8a646941-64c1-4b0a-9e3b-2d9df971bb05"],
    )
    payment_summary: PaymentSummary = Field(..., alias="paymentSummary")
    purchased_items: List[PurchasedItem] = Field(..., alias="purchasedItems")

    model_config = ConfigDict(populate_by_name=True)
