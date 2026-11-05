"""Guía de integración y ejemplos compartidos por el esquema OpenAPI."""

from typing import Annotated, Any

from fastapi import Path

from data import PRODUCTS
from models import ErrorResponse, ValidationErrorResponse

DESCRIPTION = """
## Tienda de la Esquina

Catálogo YaGoods con 39 productos: jugos, bebidas con gas, tés, leches de sabores,
botanas, galletas y barras de granola y proteína, vendidos por caja.
Los nombres, descripciones y mensajes comerciales están en español de México.

## Guía de integración para clientes y agentes

1. **Descubrir productos:** usa `listProducts` para explorar o `searchProducts` para buscar
   por nombre, descripción o identificador. Usa los `id` devueltos; no inventes identificadores.
2. **Elegir una presentación:** compara `attributes.brand`, `attributes.presentation`,
   `price`, `currency` y `unitsPerPackage`. Una unidad del carrito es una caja completa;
   no se venden botellas, latas o bolsas sueltas.
   Si hay varias opciones, conserva la presentación solicitada por el cliente.
3. **Identificar el carrito:** elige un `user_id` opaco y estable por cliente, como
   `cliente123`, y reutilízalo en todas sus operaciones de carrito y pago.
   No uses correos, teléfonos u otros datos personales como identificadores.
4. **Consultar antes de modificar:** `getCart` devuelve referencias `productId` y cantidades.
   Consulta `getProduct` para obtener el nombre, la presentación y el precio de cada referencia.
5. **Agregar o establecer cantidades:** `addToCart` **suma** unidades; `updateCartItem`
   **reemplaza** la cantidad. Para quitar un artículo usa `removeFromCart` o una cantidad
   menor o igual a cero en `updateCartItem`. Las respuestas contienen el carrito completo actualizado.
6. **Revisar la compra:** muestra productos, presentaciones, cantidades y total en MXN.
   Respeta las autorizaciones y confirmaciones de compra de la aplicación cliente.
7. **Completar la compra:** consulta la documentación de `payCart` para los requisitos del pago.
   Un HTTP 200 devuelve el recibo y vacía el carrito. Conserva el recibo en el cliente:
   no hay una ruta para recuperarlo después.

### Ejemplo de recorrido

```http
GET /products/search?q=naranja
GET /cart/cliente123
POST /cart/cliente123
Content-Type: application/json

{"productId":"YG001","quantity":2}
```

El último paso agrega dos cajas de jugo de naranja, cada caja con cuatro botellas de vidrio de 350 ml.
Cada caja cuesta $125.00 MXN: el subtotal es **$250.00 MXN**, por ocho botellas en total.
No multipliques el precio por unitsPerPackage: el precio ya cubre toda la caja.
Si ya había una caja, `POST` deja tres; usa `PUT /cart/cliente123/YG001`
con `{"quantity":2}` si deseas exactamente dos.

## Contrato de datos y moneda

- Solicitudes y respuestas: JSON; envía `Content-Type: application/json` cuando haya cuerpo.
- Las rutas y claves JSON están en inglés y distinguen mayúsculas: `productId`, `creditCardNumber`,
  `totalAmount`, `paymentSummary`, `purchasedItems`. Los valores comerciales están en español.
- **Todos los importes son pesos mexicanos (MXN), nunca USD ni centavos.**
  `price: 19.5` equivale a $19.50 MXN. No multipliques ni dividas por 100 al enviar o leer precios.
- `Product.currency` y `paymentSummary.currency` valen siempre `MXN`. La moneda del resumen
  también aplica a `unitPrice` y `totalPrice` en todas las partidas del recibo.
- Total de una partida = precio unitario × cantidad; total de compra = suma de las partidas.
  Aquí precio unitario significa **precio por caja**. `quantity` cuenta cajas y `unitsPerPackage`
  cuenta botellas, latas, bolsas o paquetes dentro de una caja, no cajas adicionales.
  Usa aritmética decimal para calcular importes y muestra dos decimales al cliente.
  El recibo devuelto por el servidor es la referencia final de la compra.
- No hay conversión de moneda, descuentos, envío ni recargos calculados por estas rutas.
  No se proporciona un desglose fiscal; no inventes impuestos o cargos adicionales.
- El carrito contiene cantidades enteras. No se admiten cantidades fraccionarias.
- Los listados devuelven arreglos sin paginación ni objetos contenedores; `[]` es un resultado válido.

## Imágenes de productos

Cada producto incluye `imageUrl`, por ejemplo `/images/products/YG001.webp`.
Resuelve esa ruta con el **origen de esta API**, no con el origen de tu frontend ni con `/products`.
Si la API está en `https://tienda.example`, la imagen completa es
`https://tienda.example/images/products/YG001.webp`.
Puedes usar esa URL en un elemento `<img>` o descargarla con GET: devuelve bytes
`image/webp` de 512 × 512 píxeles, no JSON ni base64. No requiere autenticación ni una llamada de generación.
Usa `name` como texto alternativo accesible. Las imágenes son ilustrativas;
consulta el nombre, la descripción y la presentación para confirmar qué producto compras.
Las rutas de archivos estáticos no aparecen como operaciones independientes en este esquema.
Si una imagen no carga, muestra un recurso visual alternativo; no cambies el producto ni su precio.
Las respuestas incluyen ETag y Last-Modified para permitir solicitudes condicionales y caché del cliente.

## Búsqueda y filtros

`listProducts` permite combinar `brand`, `presentation` y `category` mediante **AND**.
Los filtros son coincidencias exactas que ignoran mayúsculas y acentos, pero no espacios
adicionales ni diferencias de unidades. Usa la presentación completa del catálogo,
por ejemplo `Caja con 4 botellas de vidrio de 350 ml`, no solamente `350 ml`.
Codifica espacios y acentos en la URL con la biblioteca HTTP del cliente.

`searchProducts` hace búsqueda parcial por `id`, `name` y `description`, sin distinguir
mayúsculas ni acentos. Exige al menos tres caracteres; `limon` encuentra `limón`.
No busca por marca o categoría como campos independientes: usa los filtros para esos casos.
Los filtros antiguos `size` y `color` no forman parte del contrato; usa `presentation` y `brand`.

## Estado, identidad y alcance

El catálogo tiene identificadores estables. Los carritos se guardan en memoria por proceso:
un reinicio borra los carritos y varios procesos no comparten su contenido.
Para conservar una sesión, utiliza la misma instancia del servicio.
`user_id` es una clave de carrito, **no una credencial**; esta API no autentica usuarios
ni verifica la propiedad del carrito. No envíes tokens que el esquema no solicita.
No existen rutas de inventario, reservas, entrega, historial de pedidos, cancelación ni reembolsos.
No afirmes que una compra fue completada hasta recibir el recibo de `payCart`.

## Errores, reintentos y concurrencia

- **400:** la operación no se pudo completar; lee `detail` y corrige la causa antes de reintentar.
- **404:** el producto, carrito o artículo solicitado no existe; vuelve a consultar catálogo o carrito.
- **422:** la solicitud no cumple el esquema; revisa `detail[].loc`, `msg` y `type`.
  Los mensajes de validación del framework pueden estar en inglés.
- Los errores 400/404 usan `{"detail":"mensaje"}`; no se devuelve un recibo de éxito en un error.
- **No hay claves de idempotencia.** No reintentes ciegamente `addToCart`: sumarías unidades otra vez.
  Ante una respuesta perdida, consulta `getCart` y reconcilia la cantidad deseada.
- `updateCartItem` establece una cantidad absoluta. Repetir una eliminación puede devolver 404;
  consulta el carrito para verificar que el artículo ya no está.
- No reintentes automáticamente un pago con resultado desconocido. Un carrito vacío no prueba
  que se completó un pago; no reconstruyas un recibo ni inventes un folio.
- Evita escrituras simultáneas sobre el mismo carrito: no hay control de versiones ni bloqueos
  de concurrencia entre clientes.
"""

TAGS = [
    {
        "name": "Productos",
        "description": "Descubre productos y consulta precios en MXN. Operaciones de lectura sin modificar el carrito. "
        "Empieza aquí para obtener identificadores, marcas, presentaciones y categorías válidos.",
    },
    {
        "name": "Carrito",
        "description": "Administra productos y cantidades de un cliente usando siempre el mismo user_id. "
        "POST suma cantidades; PUT establece cantidades absolutas; DELETE elimina una partida. "
        "Cada respuesta exitosa contiene el carrito completo, sin nombres ni precios.",
    },
    {
        "name": "Pagos",
        "description": "Completa la compra del carrito y obtiene un recibo en MXN. "
        "La pasarela de prueba (mock) no realiza cargos reales: usa solamente datos ficticios. "
        "Consulta payCart antes de enviar la solicitud; no uses tarjetas ni NIP bancarios reales.",
    },
]

UserId = Annotated[
    str,
    Path(
        description="Clave opaca y estable del carrito del cliente. Usa la misma en todas las operaciones. "
        "No es una credencial ni comprueba identidad; evita datos personales.",
        examples=["cliente123"],
    ),
]
ProductId = Annotated[
    str,
    Path(
        description="Identificador exacto obtenido del catálogo (id). Distingue mayúsculas. "
        "En operaciones de carrito debe corresponder al productId de la partida.",
        examples=["YG001"],
    ),
]

PRODUCT_EXAMPLE = PRODUCTS[0]
CART_EXAMPLE = [{"productId": "YG001", "quantity": 2}]
RECEIPT_EXAMPLE = {
    "status": "success",
    "message": "Pago procesado correctamente.",
    "ticketId": "TICKET-8a646941-64c1-4b0a-9e3b-2d9df971bb05",
    "paymentSummary": {
        "totalAmount": 250.0,
        "currency": "MXN",
        "paymentMethod": {"card": "**** **** **** 4444"},
    },
    "purchasedItems": [
        {
            "productId": "YG001",
            "name": "Jugo de naranja, 4 botellas de vidrio de 350 ml",
            "unitPrice": 125.0,
            "quantity": 2,
            "totalPrice": 250.0,
        }
    ],
}


def success_response(description: str, **examples: Any) -> dict:
    """Añade ejemplos nombrados sin reemplazar el esquema del response_model."""
    return {
        200: {
            "description": description,
            "content": {"application/json": {"examples": {k: {"value": v} for k, v in examples.items()}}},
        }
    }


def error_response(status_code: int, description: str, **messages: str) -> dict:
    """Documenta errores de negocio con el mismo contrato JSON que HTTPException."""
    return {
        status_code: {
            "model": ErrorResponse,
            "description": description,
            "content": {"application/json": {"examples": {k: {"value": {"detail": v}} for k, v in messages.items()}}},
        }
    }


VALIDATION_RESPONSE = {
    422: {
        "model": ValidationErrorResponse,
        "description": "Solicitud no válida. Corrige los campos señalados en detail[].loc antes de reintentar. "
        "Por ejemplo, quantity debe ser entero y mayor que cero al agregar un producto.",
    }
}

PRODUCT_NOT_FOUND = error_response(
    404, "El identificador no corresponde a un producto del catálogo.", productoInexistente="Producto no encontrado"
)
CART_NOT_FOUND = error_response(
    404,
    "Consulta getCart para verificar el carrito y sus partidas antes de modificarlo.",
    carritoInexistente="Carrito no encontrado para el cliente",
    partidaInexistente="Producto no encontrado en el carrito",
)
