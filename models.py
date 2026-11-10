from typing import Any, List, Literal

from pydantic import BaseModel, ConfigDict, Field


class RootResponse(BaseModel):
    message: str
    openapi_url: str = Field(alias="openapiUrl", description="Ruta del esquema OpenAPI")

    model_config = ConfigDict(populate_by_name=True)


class ErrorResponse(BaseModel):
    """Error de negocio: la operación solicitada no pudo completarse."""

    detail: str = Field(
        ...,
        description="Motivo del error en español; puede incluir el valor recibido y cómo corregir la solicitud",
        examples=["Carrito no encontrado para el cliente"],
    )


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
    """Atributos para distinguir productos y aplicar filtros exactos al catálogo."""

    brand: str = Field(..., description="Marca del producto según el catálogo", examples=["Nintendo"])
    platform: str = Field(
        ...,
        description="Plataforma o familia de consolas con la que es compatible el producto",
        examples=["Nintendo Switch 2", "PlayStation 5", "Xbox Series"],
    )
    category: str = Field(..., description="Categoría del producto", examples=["Videojuegos"])


class Product(BaseModel):
    """Artículo vendible por pieza; price es el precio vigente en pesos mexicanos, no centavos."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., description="SKU del catálogo e identificador único del producto", examples=["45467911"])
    name: str = Field(
        ...,
        description="Nombre del producto en español de México; suele incluir la plataforma",
        examples=["Star Fox Nintendo Switch 2"],
    )
    description: str = Field(
        ...,
        description="Descripción del producto",
        examples=["El regreso de Fox McCloud y su escuadrón a los combates de naves en Switch 2."],
    )
    price: float = Field(
        ...,
        ge=0,
        description="Precio vigente de una pieza en pesos mexicanos (MXN), no centavos. "
        "Ya incluye el descuento: es el importe que se cobra en el carrito",
        examples=[1199.2],
    )
    list_price: float = Field(
        ...,
        alias="listPrice",
        ge=0,
        description="Precio de lista antes del descuento, en MXN. Es informativo: no se cobra ni se suma a price",
        examples=[1499.0],
    )
    discount_percent: int = Field(
        ...,
        alias="discountPercent",
        ge=0,
        le=100,
        description="Descuento ya aplicado en price respecto a listPrice, en porcentaje entero. "
        "0 significa sin descuento. No lo vuelvas a aplicar",
        examples=[20],
    )
    currency: Literal["MXN"] = Field(default="MXN", description="Moneda de los precios: pesos mexicanos")
    image_url: str = Field(
        ...,
        alias="imageUrl",
        description="Ruta de la imagen ilustrativa del producto, relativa al origen de la API. "
        "Descárgala con GET sin credenciales. Devuelve image/webp de 512 × 512 píxeles, no JSON.",
        examples=["/images/products/45467911.webp"],
        json_schema_extra={"format": "uri-reference"},
    )
    tags: List[str] = Field(
        ...,
        description="Etiquetas de género, público y uso, en minúsculas y sin acentos. "
        "searchProducts también busca en ellas",
        examples=[["nave", "accion", "arcade", "nostalgia", "n64", "un-jugador"]],
    )
    attributes: ProductAttributes


class CartItem(BaseModel):
    """Partida del carrito. Consulta el producto para obtener nombre, plataforma y precio."""

    model_config = ConfigDict(populate_by_name=True)

    product_id: str = Field(..., alias="productId", description="SKU del producto", examples=["45467911"])
    quantity: int = Field(
        ...,
        gt=0,
        description="Cantidad de piezas del producto. En POST se suma a la cantidad existente.",
        examples=[2],
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
        ..., alias="totalAmount", description="Suma de todas las partidas en pesos mexicanos (MXN)", examples=[2398.4]
    )
    currency: Literal["MXN"] = Field(default="MXN", description="Moneda de todos los importes del recibo")
    payment_method: PaymentMethod = Field(..., alias="paymentMethod")

    model_config = ConfigDict(populate_by_name=True)


class PurchasedItem(BaseModel):
    """Partida del recibo: totalPrice = unitPrice × quantity, con importes en MXN."""

    product_id: str = Field(..., alias="productId", description="Identificador del producto")
    name: str = Field(..., description="Nombre del producto")
    unit_price: float = Field(
        ..., alias="unitPrice", description="Precio vigente de una pieza en pesos mexicanos (MXN), con descuento"
    )
    quantity: int = Field(..., description="Cantidad de piezas compradas")
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
