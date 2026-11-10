# API de Arkanoid

- **URL base:** `http://localhost:8000`
- **Moneda:** pesos mexicanos (`MXN`) en todos los precios e importes.
- **Esquema completo:** `/openapi.json` · **Documentación interactiva:** `/docs`

El esquema OpenAPI es el contrato de integración principal. Incluye instrucciones de uso, ejemplos nombrados, esquemas de errores y reglas de reintento para cada operación. También está disponible como archivo `openapi.json` en el repositorio; se genera con `make openapi`.

Las rutas y las claves JSON conservan sus nombres en inglés para facilitar las integraciones. El catálogo, los mensajes y las descripciones están en español.

## Productos

### `GET /products`

Consulta el catálogo. Permite combinar filtros exactos por `brand`, `platform` y `category`, sin distinguir mayúsculas ni acentos.

Ejemplos: `/products?category=Videojuegos`, `/products?platform=Nintendo%20Switch%202`, `/products?brand=Xbox`.

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

Las categorías son `Consolas`, `Videojuegos`, `Accesorios`, `Pantallas` y `Coleccionables`. `platform` usa el valor completo del catálogo: `Nintendo Switch` y `Nintendo Switch 2` son plataformas distintas. Los campos `packageType` y `unitsPerPackage` y el filtro `presentation` de la versión anterior ya no existen.

`price` es el precio vigente de una pieza, con el descuento ya aplicado, y es el importe que se cobra. `listPrice` y `discountPercent` son informativos; no vuelvas a aplicar el descuento. El carrito cuenta piezas. No hay límite de existencias: todos los productos están disponibles en cualquier cantidad. El catálogo usa los 60 SKU del CSV de origen, con precios en MXN.

`imageUrl` es relativa al origen de la API. Por ejemplo, `http://localhost:8000/images/products/45467911.webp` devuelve una imagen WebP de 512 × 512 píxeles, no JSON. No requiere credenciales. Las imágenes del CSV se sirven localmente, son ilustrativas y admiten caché condicional con ETag/Last-Modified. Las rutas estáticas no son operaciones adicionales del esquema OpenAPI.

### `GET /products/search?q=pokemon`

Busca coincidencias parciales en el identificador, nombre, descripción o etiquetas (`tags`). `q` requiere al menos tres caracteres. La búsqueda no distingue mayúsculas ni acentos: `pokemon` encuentra `Pokémon`, y `multijugador` encuentra los productos con esa etiqueta. Devuelve una lista de productos con el mismo formato que `/products`; si no hay coincidencias, devuelve `[]`.

### `GET /products/{product_id}`

Consulta un producto, por ejemplo `/products/45467911`. Devuelve el objeto del producto o un error **404** con `{"detail": "Producto no encontrado"}`.

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
