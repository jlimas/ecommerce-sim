"""Guía de integración y ejemplos compartidos por el esquema OpenAPI."""

from typing import Annotated, Any

from fastapi import Path

from data import PRODUCTS
from models import ErrorResponse, ValidationErrorResponse

DESCRIPTION = """
## Arkanoid

Tienda de videojuegos con 60 productos: consolas, videojuegos, accesorios, pantallas y coleccionables
para Nintendo Switch 2, Nintendo Switch, PlayStation 5 y Xbox Series, entre otras plataformas.
Los nombres, descripciones y mensajes comerciales están en español de México.

## Guía de integración para clientes y agentes

1. **Descubrir productos:** usa `listProducts` para explorar o `searchProducts` para buscar
   por nombre, descripción, etiqueta o identificador. Usa los `id` devueltos; no inventes identificadores.
2. **Elegir un producto:** compara `attributes.platform`, `attributes.brand`, `attributes.category`,
   `price`, `listPrice` y `discountPercent`. Confirma que la plataforma del videojuego o accesorio
   corresponde a la consola del cliente; no supongas compatibilidad entre plataformas distintas
   si la descripción del producto no la indica.
   Si hay varias opciones, conserva el producto y la plataforma solicitados por el cliente.
3. **Identificar el carrito:** elige un `user_id` opaco y estable por cliente, como
   `cliente123`, y reutilízalo en todas sus operaciones de carrito y pago.
   No uses correos, teléfonos u otros datos personales como identificadores.
4. **Consultar antes de modificar:** `getCart` devuelve referencias `productId` y cantidades.
   Consulta `getProduct` para obtener el nombre, la plataforma y el precio de cada referencia.
5. **Agregar o establecer cantidades:** `addToCart` **suma** unidades; `updateCartItem`
   **reemplaza** la cantidad. Para quitar un artículo usa `removeFromCart` o una cantidad
   menor o igual a cero en `updateCartItem`. Las respuestas contienen el carrito completo actualizado.
6. **Revisar la compra:** muestra productos, plataformas, cantidades y total en MXN.
   Respeta las autorizaciones y confirmaciones de compra de la aplicación cliente.
7. **Completar la compra:** consulta la documentación de `payCart` para los requisitos del pago.
   Un HTTP 200 devuelve el recibo y vacía el carrito. Conserva el recibo en el cliente:
   no hay una ruta para recuperarlo después.

### Ejemplo de recorrido

```http
GET /products/search?q=star%20fox
GET /cart/cliente123
POST /cart/cliente123
Content-Type: application/json

{"productId":"45467911","quantity":2}
```

El último paso agrega dos piezas de Star Fox para Nintendo Switch 2.
Cada pieza cuesta $1,199.20 MXN (precio de lista $1,499.00 MXN, con 20% de descuento ya aplicado):
el subtotal es **$2,398.40 MXN**. No vuelvas a restar el descuento: `price` ya lo incluye.
Si ya había una pieza, `POST` deja tres; usa `PUT /cart/cliente123/45467911`
con `{"quantity":2}` si deseas exactamente dos.

## Contrato de datos y moneda

- Solicitudes y respuestas: JSON; envía `Content-Type: application/json` cuando haya cuerpo.
- Las rutas y claves JSON están en inglés y distinguen mayúsculas: `productId`, `creditCardNumber`,
  `totalAmount`, `paymentSummary`, `purchasedItems`. Los valores comerciales están en español.
- **Todos los importes son pesos mexicanos (MXN), nunca USD ni centavos.**
  `price: 1199.2` equivale a $1,199.20 MXN. No multipliques ni dividas por 100 al enviar o leer precios.
- `Product.currency` y `paymentSummary.currency` valen siempre `MXN`. La moneda del resumen
  también aplica a `unitPrice` y `totalPrice` en todas las partidas del recibo.
- `price` es el **precio vigente por pieza** y el único importe que se cobra. `listPrice` es el precio
  de lista y `discountPercent` el descuento ya aplicado en `price`; ambos son informativos.
  Si `discountPercent` es 0, `price` y `listPrice` son iguales.
- Total de una partida = `price` × cantidad; total de compra = suma de las partidas.
  `quantity` cuenta piezas. Los paquetes (bundles) se venden como una sola pieza con todo su contenido.
  Usa aritmética decimal para calcular importes y muestra dos decimales al cliente.
  El recibo devuelto por el servidor es la referencia final de la compra.
- No hay cupones, descuentos adicionales, conversión de moneda, envío ni recargos calculados por estas rutas.
  No se proporciona un desglose fiscal; no inventes impuestos o cargos adicionales.
- El carrito contiene cantidades enteras. No se admiten cantidades fraccionarias.
- Los listados devuelven arreglos sin paginación ni objetos contenedores; `[]` es un resultado válido.

## Imágenes de productos

Cada producto incluye `imageUrl`, por ejemplo `/images/products/45467911.webp`.
Resuelve esa ruta con el **origen de esta API**, no con el origen de tu frontend ni con `/products`.
Si la API está en `https://tienda.example`, la imagen completa es
`https://tienda.example/images/products/45467911.webp`.
Puedes usar esa URL en un elemento `<img>` o descargarla con GET: devuelve bytes
`image/webp` de 512 × 512 píxeles, no JSON ni base64. No requiere autenticación ni una llamada de generación.
Usa `name` como texto alternativo accesible. Las imágenes son ilustrativas;
consulta el nombre, la descripción y la plataforma para confirmar qué producto compras.
Las rutas de archivos estáticos no aparecen como operaciones independientes en este esquema.
Si una imagen no carga, muestra un recurso visual alternativo; no cambies el producto ni su precio.
Las respuestas incluyen ETag y Last-Modified para permitir solicitudes condicionales y caché del cliente.

## Búsqueda y filtros

`listProducts` permite combinar `brand`, `platform` y `category` mediante **AND**.
Los filtros son coincidencias exactas que ignoran mayúsculas y acentos, pero no espacios
adicionales ni nombres abreviados. Usa la plataforma completa del catálogo,
por ejemplo `Nintendo Switch 2`, no solamente `Switch 2`; `Nintendo Switch` y `Nintendo Switch 2`
son plataformas distintas. Las categorías son `Consolas`, `Videojuegos`, `Accesorios`,
`Pantallas` y `Coleccionables`.
Codifica espacios y acentos en la URL con la biblioteca HTTP del cliente.
`brand` conserva la marca del catálogo: en varios videojuegos y accesorios es la marca de la consola
(por ejemplo, `Nintendo`), no la del estudio o editor del juego.

`searchProducts` hace búsqueda parcial por `id`, `name`, `description` y `tags`, sin distinguir
mayúsculas ni acentos. Exige al menos tres caracteres; `pokemon` encuentra `Pokémon`.
Las etiquetas describen género, público y uso, en minúsculas, sin acentos y con guiones:
`multijugador`, `nostalgia`, `familia`, `mundo-abierto`, `un-jugador`, `preventa`.
No busca por marca, plataforma o categoría como campos independientes: usa los filtros para esos casos.
Los filtros `presentation`, `size` y `color` y los campos `packageType` y `unitsPerPackage`
de versiones anteriores ya no forman parte del contrato.

## Estado, identidad y alcance

El catálogo tiene identificadores estables. Los carritos se guardan en memoria por proceso:
un reinicio borra los carritos y varios procesos no comparten su contenido.
Para conservar una sesión, utiliza la misma instancia del servicio.
`user_id` es una clave de carrito, **no una credencial**; esta API no autentica usuarios
ni verifica la propiedad del carrito. No envíes tokens que el esquema no solicita.
`stock` es una existencia de referencia: la API no reserva, valida ni descuenta inventario al comprar.
Los productos con la etiqueta `preventa` se venden igual que el resto; el catálogo no indica fechas de entrega.
No existen rutas de reservas, entrega, historial de pedidos, cancelación ni reembolsos.
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
        "Empieza aquí para obtener identificadores, marcas, plataformas y categorías válidos.",
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
        examples=["45467911"],
    ),
]

EXAMPLE_PRODUCT_ID = "45467911"
PRODUCT_EXAMPLE = next(product for product in PRODUCTS if product["id"] == EXAMPLE_PRODUCT_ID)
CART_EXAMPLE = [{"productId": EXAMPLE_PRODUCT_ID, "quantity": 2}]
RECEIPT_EXAMPLE = {
    "status": "success",
    "message": "Pago procesado correctamente.",
    "ticketId": "TICKET-8a646941-64c1-4b0a-9e3b-2d9df971bb05",
    "paymentSummary": {
        "totalAmount": 2398.4,
        "currency": "MXN",
        "paymentMethod": {"card": "**** **** **** 4444"},
    },
    "purchasedItems": [
        {
            "productId": EXAMPLE_PRODUCT_ID,
            "name": "Star Fox Nintendo Switch 2",
            "unitPrice": 1199.2,
            "quantity": 2,
            "totalPrice": 2398.4,
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
