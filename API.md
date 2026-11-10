# API de Arkanoid

- **URL base:** `http://localhost:8000`
- **Moneda:** pesos mexicanos (`MXN`) en todos los precios e importes.
- **Esquema completo:** `/openapi.json` · **Documentación interactiva:** `/docs`

El esquema OpenAPI es el contrato de integración principal. Incluye instrucciones de uso, ejemplos nombrados, esquemas de errores y reglas de reintento para cada operación. También está disponible como archivo `openapi.json` en el repositorio; se genera con `make openapi`.

Las rutas y las claves JSON conservan sus nombres en inglés para facilitar las integraciones. El catálogo, los mensajes y las descripciones están en español.

## Productos

### `GET /products`

Consulta el catálogo con filtros opcionales que se combinan con AND. Expresa la petición completa del cliente en una sola llamada.

| Parámetro | Descripción |
| --- | --- |
| `platform` | Plataforma compatible. Acepta `Switch 2`, `NS2`, `PS5`, `Xbox`; `Switch` es Nintendo Switch y nunca incluye Switch 2. |
| `category` | `Consolas`, `Videojuegos`, `Accesorios`, `Pantallas`, `Coleccionables`; acepta singular, plural y `juegos`. |
| `brand` | Marca del catálogo; `Sony` → PlayStation, `Microsoft` → Xbox. |
| `tag` | Una o más etiquetas separadas por comas, todas requeridas; acepta sinónimos como `familiar` → `familia`. |
| `q` | Texto libre en id, nombre, descripción y etiquetas (mínimo 3 caracteres). |
| `minPrice` / `maxPrice` | Rango inclusivo sobre `price` en MXN; acepta `1800`, `$1,800` o `1800 MXN`. |
| `sort` | `relevance`, `priceAsc`, `priceDesc`, `discountDesc` o `nameAsc`. |
| `limit` | Máximo de productos devueltos (1-100), después de ordenar. |

Ejemplos:

- `/products?platform=Switch%202&category=Videojuegos&tag=familia&maxPrice=1800`: juegos familiares para Switch 2 de hasta $1,800 MXN.
- `/products?platform=PS5&category=Accesorios&sort=priceAsc&limit=5`: los cinco accesorios más baratos para PS5.
- `/products?platform=Switch%202&q=mario`: productos de Mario para Switch 2.

Los parámetros vacíos o con `null`, `undefined`, `todos` o `cualquiera` se ignoran. Un valor de `platform`, `category`, `brand`, `tag` o `sort` que no existe en el catálogo devuelve **400** con la lista de valores válidos en `detail`; un rango con `minPrice` mayor que `maxPrice` también devuelve 400. `[]` significa que los filtros son válidos pero ningún producto los cumple todos a la vez.

```json
[
  {
    "id": "45467911",
    "name": "Star Fox Nintendo Switch 2",
    "description": "El regreso de Fox McCloud y su escuadrón a los combates de naves en Switch 2. Para quien creció con Star Fox 64 y su 'Do a barrel roll!'.",
    "price": 1199.2,
    "listPrice": 1499.0,
    "discountPercent": 20,
    "currency": "MXN",
    "imageUrl": "/images/products/45467911.webp",
    "tags": ["nave", "accion", "arcade", "nostalgia", "n64", "un-jugador"],
    "attributes": {
      "brand": "Nintendo",
      "platform": "Nintendo Switch 2",
      "category": "Videojuegos"
    }
  }
]
```

`Nintendo Switch` y `Nintendo Switch 2` son plataformas distintas. Los campos `packageType` y `unitsPerPackage` y el filtro `presentation` de la versión anterior ya no existen.

`price` es el precio vigente de una pieza, con el descuento ya aplicado, y es el importe que se cobra. `listPrice` y `discountPercent` son informativos; no vuelvas a aplicar el descuento. El carrito cuenta piezas. No hay límite de existencias: todos los productos están disponibles en cualquier cantidad. El catálogo usa los 60 SKU del CSV de origen, con precios en MXN.

`imageUrl` es relativa al origen de la API. Por ejemplo, `http://localhost:8000/images/products/45467911.webp` devuelve una imagen WebP de 512 × 512 píxeles, no JSON. No requiere credenciales. Las imágenes del CSV se sirven localmente, son ilustrativas y admiten caché condicional con ETag/Last-Modified. Las rutas estáticas no son operaciones adicionales del esquema OpenAPI.

### `GET /products/search?q=pokemon`

Atajo de solo texto, equivalente a `/products?q=...`. Busca coincidencias parciales en el identificador, nombre, descripción o etiquetas (`tags`); si la frase completa no aparece, devuelve los productos con todas sus palabras significativas. `q` requiere al menos tres caracteres. La búsqueda no distingue mayúsculas ni acentos: `pokemon` encuentra `Pokémon`, y `multijugador` encuentra los productos con esa etiqueta. Devuelve una lista de productos con el mismo formato que `/products`; si no hay coincidencias, devuelve `[]`.

### `GET /products/{product_id}`

Consulta un producto, por ejemplo `/products/45467911`. Devuelve el objeto del producto o un error **404** cuyo `detail` empieza con `Producto no encontrado`, repite el id recibido y explica cómo construir la ruta. El id es el SKU de 8 dígitos y va en la ruta; no existe `/products/detail` ni `?id=`.

## Carrito

`user_id` identifica el carrito del cliente (por ejemplo, `cliente123`); no representa autenticación.

### `GET /cart/{user_id}`

Consulta el carrito. Un cliente sin productos recibe `[]`.

```json
[
  {"productId": "45467911", "quantity": 2}
]
```

### `POST /cart/{user_id}`

Agrega un producto existente. Si ya está en el carrito, incrementa su cantidad. `quantity` debe ser un entero mayor que cero.

```json
{"productId": "45467911", "quantity": 2}
```

Devuelve el carrito actualizado. Si el producto no existe, devuelve **404**.

### `PUT /cart/{user_id}/{product_id}`

Reemplaza la cantidad de un producto del carrito. Un valor de cero o menor elimina el producto.

```json
{"quantity": 3}
```

Devuelve el carrito actualizado. Si el carrito o el producto en el carrito no existe, devuelve **404**.

### `DELETE /cart/{user_id}/{product_id}`

Elimina el producto y devuelve el carrito actualizado. Si el carrito o el producto en el carrito no existe, devuelve **404**.

## Pagos

### `POST /payments/{user_id}`

Procesa el carrito completo y genera un recibo en MXN. Al aprobarse el pago, vacía el carrito.

**Pasarela de prueba (mock): no realiza cargos reales.** Usa exclusivamente una tarjeta ficticia y un PIN de prueba. No envíes tarjetas ni NIP bancarios reales. El número debe contener al menos cuatro dígitos (se permiten espacios); el PIN debe coincidir con sus últimos cuatro dígitos.

```json
{
  "creditCardNumber": "1111222233334444",
  "pin": "4444"
}
```

Respuesta **200**, para un carrito con dos piezas de `45467911`:

```json
{
  "status": "success",
  "message": "Pago procesado correctamente.",
  "ticketId": "TICKET-a1b2c3d4-...",
  "paymentSummary": {
    "totalAmount": 2398.4,
    "currency": "MXN",
    "paymentMethod": {"card": "**** **** **** 4444"}
  },
  "purchasedItems": [
    {
      "productId": "45467911",
      "name": "Star Fox Nintendo Switch 2",
      "unitPrice": 1199.2,
      "quantity": 2,
      "totalPrice": 2398.4
    }
  ]
}
```

`paymentSummary.currency` aplica tanto al total como a cada precio del recibo.

Errores **400** (no se vacía el carrito):

- `El carrito está vacío o no existe`
- `Formato de tarjeta no válido`
- `PIN de prueba no válido`

Las solicitudes que no cumplen los tipos, campos requeridos o límites del esquema devuelven **422** con los detalles de validación de FastAPI.
