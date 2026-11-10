"""Guía de integración y ejemplos compartidos por el esquema OpenAPI."""

from typing import Annotated, Any

from fastapi import Path

from catalog_query import BRANDS, CATEGORIES, PLATFORMS, SORT_OPTIONS
from catalog_query import TAGS as CATALOG_TAGS
from data import PRODUCTS
from models import ErrorResponse, ValidationErrorResponse

DESCRIPTION = """
## Arkanoid

Tienda de videojuegos con 60 productos: consolas, videojuegos, accesorios, pantallas y coleccionables
para Nintendo Switch 2, Nintendo Switch, PlayStation 5 y Xbox Series, entre otras plataformas.
Los nombres, descripciones y mensajes comerciales están en español de México.

## Guía de integración para clientes y agentes

1. **Descubrir productos:** usa `listProducts` con los filtros que expresen la petición del cliente
   (plataforma, categoría, etiqueta, rango de precio, texto libre y orden) en **una sola llamada**.
   Por ejemplo, "juegos familiares para Switch 2 de hasta $1,800" es
   `GET /products?platform=Nintendo Switch 2&category=Videojuegos&tag=familia&maxPrice=1800`.
   `searchProducts` es un atajo de solo texto. Usa los `id` devueltos como `productId`;
   no inventes identificadores de producto.
2. **Elegir un producto:** compara `attributes.platform`, `attributes.brand`, `attributes.category`,
   `price`, `listPrice` y `discountPercent`. Confirma que la plataforma del videojuego o accesorio
   corresponde a la consola del cliente; no supongas compatibilidad entre plataformas distintas
   si la descripción del producto no la indica.
   Si hay varias opciones, conserva el producto y la plataforma solicitados por el cliente.
3. **Identificar el carrito:** tú generas el `user_id`; ninguna sesión ni ruta lo proporciona.
   Al inicio de la conversación crea un texto opaco, como `cliente-7f3a9c`, y reutilízalo en todas
   las operaciones de carrito y pago de ese cliente. Cualquier texto no vacío es válido: no hay registro,
   login ni ruta para crear sesiones, y el carrito se crea solo en la primera llamada.
   No uses correos, teléfonos u otros datos personales como `user_id`.
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

{search_guide}
## Estado, identidad y alcance

El catálogo tiene identificadores estables. Los carritos se guardan en memoria por proceso:
un reinicio borra los carritos y varios procesos no comparten su contenido.
Para conservar una sesión, utiliza la misma instancia del servicio.
`user_id` es una clave de carrito, **no una credencial**; esta API no autentica usuarios
ni verifica la propiedad del carrito. No envíes tokens que el esquema no solicita.
No hay límite de existencias: todos los productos del catálogo están disponibles en cualquier cantidad.
La API no maneja inventario; no digas que un producto está agotado o tiene piezas limitadas.
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

SEARCH_GUIDE = f"""## Búsqueda y filtros

`listProducts` combina todos sus parámetros mediante **AND** y todos son opcionales:

| Parámetro | Qué hace | Ejemplo |
| --- | --- | --- |
| `platform` | Plataforma compatible | `Nintendo Switch 2` |
| `category` | Tipo de producto | `Videojuegos` |
| `brand` | Marca del catálogo | `Nintendo` |
| `tag` | Una o más etiquetas separadas por comas; el producto debe tener todas | `familia,multijugador` |
| `q` | Texto libre en id, nombre, descripción y etiquetas | `mario` |
| `minPrice` / `maxPrice` | Rango inclusivo sobre `price` (precio vigente con descuento), en MXN | `maxPrice=1800` |
| `sort` | Orden del resultado | `priceAsc` |
| `limit` | Máximo de productos devueltos, después de ordenar | `10` |

**Valores tolerantes.** `platform`, `category`, `brand` y `tag` ignoran mayúsculas, acentos, guiones,
espacios repetidos y plurales, y aceptan nombres cortos y sinónimos comunes:
`Switch 2`, `switch2` o `NS2` equivalen a `Nintendo Switch 2`; `Switch` equivale a `Nintendo Switch`
(nunca incluye Switch 2); `PS5` a `PlayStation 5`; `Xbox` o `Series X` a `Xbox Series`;
`juegos` o `videojuego` a `Videojuegos`; `familiar` o `infantil` a la etiqueta `familia`;
`mundo abierto` a `mundo-abierto`; `Sony` a la marca `PlayStation`.
Los precios aceptan `1800`, `1800.50`, `$1,800` o `1800 MXN`; la coma es separador de miles.
`min_price` y `max_price` también se aceptan como nombres de parámetro.

**Parámetros vacíos.** Un parámetro ausente, vacío o con `null`, `undefined`, `todos` o `cualquiera`
se ignora: no filtra. Envía únicamente los filtros que el cliente pidió.

**Errores en vez de listas vacías engañosas.** Si un valor de `platform`, `category`, `brand`, `tag`
o `sort` no corresponde a nada del catálogo, la respuesta es **400** y `detail` enumera los valores
válidos; corrige el valor y vuelve a consultar. Un **200 con `[]`** significa que los valores son
válidos pero ningún producto cumple **todos** los filtros a la vez: relaja un filtro (por ejemplo
`maxPrice` o `tag`) en lugar de concluir que el catálogo está vacío. El catálogo nunca está vacío:
`GET /products` sin parámetros devuelve los {len(PRODUCTS)} productos.

Valores del catálogo, de mayor a menor número de productos:

- **platform:** {", ".join(f"`{v}`" for v in PLATFORMS)}.
  `Nintendo Switch` y `Nintendo Switch 2` son plataformas distintas; no supongas compatibilidad
  entre ellas si la descripción del producto no la indica. `Nintendo` corresponde a un solo
  accesorio; para todo lo de Nintendo usa `brand=Nintendo`.
- **category:** {", ".join(f"`{v}`" for v in CATEGORIES)}.
- **brand:** {", ".join(f"`{v}`" for v in BRANDS)}. En varios videojuegos y accesorios es la marca de la
  consola (por ejemplo `Nintendo`), no la del estudio o editor del juego.
- **tag:** {", ".join(f"`{v}`" for v in CATALOG_TAGS)}.

**Texto libre (`q`).** Busca sin distinguir mayúsculas ni acentos en `id`, `name`, `description` y
`tags`; requiere al menos tres letras o dígitos. Primero busca la frase completa; si no aparece,
devuelve los productos que contienen todas las palabras significativas (ignora artículos y
preposiciones como `de`, `para` o `la`). `pokemon` encuentra `Pokémon`; `4467` encuentra varios SKU.
No busca en marca, plataforma ni categoría como campos: usa sus filtros. Con `q` y sin `sort`,
el resultado empieza por las coincidencias de la frase completa.

**Orden (`sort`).** {"; ".join(f"`{k}`: {v}" for k, v in SORT_OPTIONS.items())}
También acepta `price_asc`, `price-desc`, `precio`, `menor precio`, `descuento` o `-price` (descendente).

Codifica espacios y acentos en la URL con la biblioteca HTTP del cliente.
Los filtros `presentation`, `size` y `color` y los campos `packageType`, `unitsPerPackage` y `stock`
de versiones anteriores ya no forman parte del contrato.
"""
DESCRIPTION = DESCRIPTION.replace("{search_guide}", SEARCH_GUIDE)

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
        description="Clave del carrito que genera el cliente o agente: cualquier texto no vacío, "
        "por ejemplo cliente-7f3a9c. No hay registro, login ni ruta de sesión; el carrito se crea solo "
        "en la primera llamada. Genera una al inicio de la conversación y reutilízala en todas las "
        "operaciones de carrito y pago. No es una credencial; no uses correos, teléfonos ni datos personales.",
        examples=["cliente-7f3a9c", "cliente123"],
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

PRODUCT_FILTER_ERRORS = error_response(
    400,
    "Un valor de filtro no existe en el catálogo o el rango de precios no es válido. detail explica la causa "
    "y, para platform, category, brand, tag y sort, enumera todos los valores válidos. "
    "Corrige ese parámetro y vuelve a consultar; no concluyas que el catálogo está vacío.",
    plataformaDesconocida="Plataforma no reconocida: 'Switch 3'. Valores válidos: " + ", ".join(PLATFORMS) + ".",
    etiquetaDesconocida="Etiqueta no reconocida: 'terror'. Valores válidos: " + ", ".join(CATALOG_TAGS) + ".",
    rangoInvalido="minPrice (2000.0) no puede ser mayor que maxPrice (1800.0).",
    consultaCorta="q requiere al menos 3 letras o dígitos.",
)
