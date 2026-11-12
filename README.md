# Arkanoid

API de Arkanoid, una tienda de videojuegos con catálogo, carrito y recibos de compra. Ofrece consolas, videojuegos, accesorios, pantallas y coleccionables para Nintendo Switch 2, Nintendo Switch, PlayStation 5 y Xbox Series, entre otras plataformas. El catálogo, la documentación y los mensajes están en español de México. Todos los precios e importes están en **pesos mexicanos (MXN)**.

## Desarrollo local

Requisitos: `uv` actualizado. El proyecto utiliza Python **3.15.2**; `uv` descarga la versión indicada en `.python-version` cuando es necesario.

```bash
make install
make run
```

- API: `http://localhost:8000/api`
- Documentación interactiva: `http://localhost:8000/api/docs`
- Esquema OpenAPI: `http://localhost:8000/api/openapi.json`

La API vive bajo `/api`. Las rutas anteriores en la raíz (`/products`, `/cart`, `/payments`, `/images`, `/openapi.json`, `/docs`) siguen respondiendo como alias para no romper integraciones existentes; las nuevas integraciones deben usar `/api`.

### Tienda web (frontend)

La tienda en React vive en `frontend/` (Vite, shadcn/ui, pnpm). Con la API corriendo:

```bash
cd frontend
pnpm install
pnpm dev
```

Abre `http://localhost:5173`; el servidor de Vite reenvía `/api` a `http://localhost:8000` (cámbialo con `ARKANOID_API_URL`). Si existe `frontend/dist` (`pnpm build`), FastAPI sirve la tienda en `/` y la API en `/api`; sin ese directorio, `/` responde con la bienvenida de la API. `ARKANOID_FRONTEND_DIST` permite indicar otro directorio.

El esquema incluye una guía para agentes e integraciones: flujo de compra, identificadores de operación estables, ejemplos de solicitudes y respuestas, reglas de moneda, errores, reintentos y el funcionamiento del PIN de prueba del pago. Puedes importar el archivo [openapi.json](openapi.json) en herramientas de agentes. Regénéralo con `make openapi` al cambiar rutas, modelos o documentación; las pruebas verifican que coincida con el esquema servido por la API.

Consulta [API.md](API.md) y los ejemplos de `requests/*.http` para explorar productos y completar una compra.

## Catálogo y moneda

El catálogo contiene 60 productos cargados de `catalog/products.csv`: 6 consolas, 29 videojuegos, 22 accesorios, 2 pantallas y 1 coleccionable, con sus SKU originales. Por ejemplo, `45467911` es Star Fox para Nintendo Switch 2 a $1,199.20 MXN (precio de lista $1,499.00 MXN, 20% de descuento). Los productos incluyen marca, plataforma y categoría. `GET /products` combina en una sola llamada filtros por plataforma, categoría, marca, etiquetas, texto libre y rango de precio, con orden y límite; acepta nombres cortos y sinónimos (`Switch 2`, `PS5`, `juegos`, `familiar`), ignora parámetros vacíos o `null` y responde 400 con los valores válidos cuando un filtro no existe en el catálogo. Ejemplo: `/products?platform=Switch 2&category=Videojuegos&tag=familia&maxPrice=1800`.

`price` es el precio vigente de una pieza y el importe que se cobra; `listPrice` y `discountPercent` informan el precio de lista y el descuento ya aplicado. `quantity` cuenta piezas: dos piezas de `45467911` cuestan $2,398.40 MXN. `tags` describe género, público y uso (`multijugador`, `nostalgia`, `mundo-abierto`). No se maneja inventario: todos los productos están disponibles en cualquier cantidad.

Todos los precios del CSV están en MXN; no se realiza conversión de divisas. Los nombres visibles de las categorías se definen en `catalog/localization.json`. Consulta [catalog/README.md](catalog/README.md) para el origen de los datos y las decisiones de normalización.

Las rutas y los campos principales de JSON conservan sus nombres (`/products`, `productId`, `totalAmount`, etc.). Respecto a la versión anterior de la tienda, el atributo y filtro `presentation` se sustituye por `platform`; se eliminan `packageType` y `unitsPerPackage` y se agregan `listPrice`, `discountPercent` y `tags`. Los productos incluyen `currency: "MXN"`; en los recibos, `paymentSummary.currency` indica la moneda de todos los importes.

## Imágenes

Cada producto incluye `imageUrl`, una ruta como `/images/products/45467911.webp` relativa al origen de la API. Las 60 imágenes del CSV se descargan previamente y se sirven desde la misma aplicación como archivos WebP de 512 × 512 píxeles, sin autenticación, dependencias de almacenamiento externo en ejecución ni llamadas de IA durante las solicitudes. Se incluyen en la imagen Docker.

Las imágenes activas provienen de los enlaces `imagen_url` del CSV y se optimizan con Pillow. Son ilustrativas; los nombres, precios y plataformas del catálogo son la referencia de compra. Para restaurar imágenes faltantes, ejecuta `uv run --locked python sync_catalog_images.py`; no requiere claves ni genera cargos de IA.

La generación con OpenAI se conserva como opción futura y no se utiliza para las imágenes activas. Para generar imágenes nuevas, configura `OPENAI_API_KEY` en tu entorno y ejecuta:

```bash
uv run --locked python generate_product_images.py
```

El script conserva los archivos existentes. Puedes seleccionar un producto con `--product-id 45467911` y regenerarlo explícitamente con `--overwrite`. La generación utiliza la API de OpenAI (`gpt-image-1.5` por defecto) y tiene un costo; no se ejecuta al instalar, iniciar, probar ni construir la aplicación. Las credenciales y Pillow no son necesarios en producción. Nunca guardes la clave en el repositorio.

## Pagos

La pasarela de pago es de prueba: **no realiza cargos reales**. Usa únicamente datos ficticios, por ejemplo la tarjeta `1111222233334444` y el PIN `4444`. El PIN debe coincidir con los últimos cuatro dígitos de la tarjeta. **No envíes tarjetas ni NIP bancarios reales.** Estas reglas también aparecen en la operación de pago del esquema OpenAPI.

## Registros

Cada operación escribe una línea en stdout con el formato `fecha NIVEL arkanoid operación {json}`: los parámetros recibidos y los valores del catálogo a los que se resolvieron, el número de resultados y los primeros SKU, los cambios del carrito y los recibos (folio, total y partidas). Los errores 400, 404 y 422 de las operaciones se registran como `WARNING` con su `detail`. `productQueryCleanup` muestra cuando se descartaron parámetros vacíos o `null` o se normalizaron precios. Nunca se registran números de tarjeta ni PIN. Ajusta el nivel con `LOG_LEVEL` (por defecto `INFO`).

El access log de uvicorn omite las respuestas 404, que en su mayoría son escáneres buscando archivos como `/.env`; los 404 de negocio (producto o carrito inexistente) siguen apareciendo como operaciones.

## Estructura y almacenamiento

- `main.py`: aplicación FastAPI y registro de rutas.
- `api_documentation.py`: guía de integración, parámetros y ejemplos del esquema OpenAPI.
- `openapi.json`: contrato generado con `make openapi`.
- `static/products/`: imágenes WebP servidas en `/images/products/`.
- `generate_product_images.py`: generación de imágenes opcional, solo en desarrollo.
- `sync_catalog_images.py`: copia local y optimización de las imágenes del CSV.
- `catalog/`: CSV de origen, nombres de categorías y decisiones de normalización.
- `data.py`: carga del catálogo local y carritos en memoria.
- `catalog_query.py`: filtros tolerantes, sinónimos, búsqueda por texto y ordenamiento del catálogo.
- `app_logging.py`: registro de operaciones y filtro de respuestas 404 en el access log.
- `models.py`: contratos Pydantic de solicitudes y respuestas.
- `apis/`: operaciones de productos, carrito y pagos.
- `requests/`: ejemplos de solicitudes HTTP.
- `tests/`: pruebas de catálogo, carrito, pagos y esquema OpenAPI.

Los carritos se pierden al reiniciar el proceso y no se comparten entre procesos. El catálogo no cambia al reiniciar. No hay autenticación: el identificador del cliente identifica su carrito, pero no verifica su identidad. No expongas datos sensibles en esta instancia.

## Verificación

```bash
make lint
make test
```

Las dependencias de ejecución y desarrollo se declaran en `pyproject.toml` y se fijan en `uv.lock`. `make install` sincroniza el entorno con ese archivo. Para actualizarlas, ejecuta `uv lock --upgrade`, `uv sync --locked` y `make requirements`; este último exporta únicamente las dependencias de ejecución a `requirements.txt` para Docker. Ruff y su hook de pre-commit deben usar la misma versión.

## Docker

```bash
make docker-build
make docker-run
```

La imagen compila la tienda web y la sirve en `http://localhost:8000/`; la API queda en `http://localhost:8000/api`.

## Despliegue

Cada push a `main` se despliega en `https://arkanoid.store` a partir del `Dockerfile` (un solo contenedor en el puerto 8000). Antes de integrar a `main`, ejecuta `make test` y `make docker-build`.
