# API de Tienda de la Esquina

- **URL base:** `http://localhost:8000`
- **Moneda:** pesos mexicanos (`MXN`) en todos los precios e importes.
- **Esquema completo:** `/openapi.json` · **Documentación interactiva:** `/docs`

El esquema OpenAPI es el contrato de integración principal. Incluye instrucciones de uso, ejemplos nombrados, esquemas de errores y reglas de reintento para cada operación. También está disponible como archivo `openapi.json` en el repositorio; se genera con `make openapi`.

Las rutas y las claves JSON conservan sus nombres en inglés para facilitar las integraciones. El catálogo, los mensajes y las descripciones están en español.

## Productos

### `GET /products`

Consulta el catálogo. Permite combinar filtros exactos por `brand`, `presentation` y `category`, sin distinguir mayúsculas ni acentos.

Ejemplos: `/products?category=Botanas`, `/products?brand=YaGoods`.

```json
[
  {
    "id": "YG001",
    "name": "Jugo de naranja, 4 botellas de vidrio de 350 ml",
    "description": "Jugo de naranja sin azúcar añadida.",
    "price": 125.0,
    "currency": "MXN",
    "imageUrl": "/images/products/YG001.webp",
    "packageType": "caja",
    "unitsPerPackage": 4,
    "attributes": {
      "brand": "YaGoods",
      "presentation": "Caja con 4 botellas de vidrio de 350 ml",
      "category": "Jugos y bebidas"
    }
  }
]
```

Los antiguos atributos y filtros `size` y `color` se sustituyen por `presentation` y `brand`.

`price` cubre una caja completa; `unitsPerPackage` indica las unidades dentro de la caja. El carrito cuenta cajas, no botellas ni bolsas sueltas. El catálogo usa los 39 SKU del CSV de origen, traducidos al español de México. Los precios numéricos del CSV se interpretan como MXN porque no se proporciona una moneda de origen.

`imageUrl` es relativa al origen de la API. Por ejemplo, `http://localhost:8000/images/products/YG001.webp` devuelve una imagen WebP de 512 × 512 píxeles, no JSON. No requiere credenciales. Las imágenes del CSV se sirven localmente, son ilustrativas y admiten caché condicional con ETag/Last-Modified. Las rutas estáticas no son operaciones adicionales del esquema OpenAPI.

### `GET /products/search?q=limon`

Busca coincidencias parciales en el identificador, nombre o descripción. `q` requiere al menos tres caracteres. La búsqueda no distingue mayúsculas ni acentos: `limon` encuentra `limón`. Devuelve una lista de productos con el mismo formato que `/products`; si no hay coincidencias, devuelve `[]`.

### `GET /products/{product_id}`

Consulta un producto, por ejemplo `/products/YG001`. Devuelve el objeto del producto o un error **404** con `{"detail": "Producto no encontrado"}`.

## Carrito

`user_id` identifica el carrito del cliente (por ejemplo, `cliente123`); no representa autenticación.

### `GET /cart/{user_id}`

Consulta el carrito. Un cliente sin productos recibe `[]`.

```json
[
  {"productId": "YG001", "quantity": 2}
]
```

### `POST /cart/{user_id}`

Agrega un producto existente. Si ya está en el carrito, incrementa su cantidad. `quantity` debe ser un entero mayor que cero.

```json
{"productId": "YG001", "quantity": 2}
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

Respuesta **200**, para un carrito con dos cajas de `YG001` (ocho botellas en total):

```json
{
  "status": "success",
  "message": "Pago procesado correctamente.",
  "ticketId": "TICKET-a1b2c3d4-...",
  "paymentSummary": {
    "totalAmount": 250.0,
    "currency": "MXN",
    "paymentMethod": {"card": "**** **** **** 4444"}
  },
  "purchasedItems": [
    {
      "productId": "YG001",
      "name": "Jugo de naranja, 4 botellas de vidrio de 350 ml",
      "unitPrice": 125.0,
      "quantity": 2,
      "totalPrice": 250.0
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
