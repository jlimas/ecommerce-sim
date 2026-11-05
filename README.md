# Tienda de la Esquina

API de una tienda con catálogo YaGoods, carrito y recibos de compra. Ofrece bebidas, botanas, galletas y barras de granola y proteína por caja. El catálogo, la documentación y los mensajes están en español de México. Todos los precios e importes están en **pesos mexicanos (MXN)**.

## Desarrollo local

Requisitos: `uv` actualizado. El proyecto utiliza Python **3.15.2**; `uv` descarga la versión indicada en `.python-version` cuando es necesario.

```bash
make install
make run
```

- API: `http://localhost:8000`
- Documentación interactiva: `http://localhost:8000/docs`
- Esquema OpenAPI: `http://localhost:8000/openapi.json`

El esquema incluye una guía para agentes e integraciones: flujo de compra, identificadores de operación estables, ejemplos de solicitudes y respuestas, reglas de moneda, errores, reintentos y el funcionamiento del PIN de prueba del pago. Puedes importar el archivo [openapi.json](openapi.json) en herramientas de agentes. Regénéralo con `make openapi` al cambiar rutas, modelos o documentación; las pruebas verifican que coincida con el esquema servido por la API.

Consulta [API.md](API.md) y los ejemplos de `requests/*.http` para explorar productos y completar una compra.

## Catálogo y moneda

El catálogo contiene 39 productos importados de `catalog/products.csv`, con SKU originales (`YG001` a `YG039`) y traducciones mexicanas en `catalog/localization.json`. Por ejemplo, YG001 es una caja con cuatro botellas de jugo de naranja de 350 ml a $125.00 MXN. Los productos incluyen marca, presentación y categoría; se pueden filtrar por estos atributos y buscar sin distinguir mayúsculas ni acentos.

`price` es el precio de una caja completa y `quantity` cuenta cajas. `unitsPerPackage` indica cuántas botellas, latas, bolsas o paquetes contiene una caja; no multipliques el precio por ese número. Dos cajas de YG001 contienen ocho botellas y cuestan $250.00 MXN.

El CSV no especifica moneda: se conservan sus precios numéricos como MXN, sin suponer un tipo de cambio. Los valores faltantes de marca y disponibilidad se completan con YaGoods y activo, respectivamente. Se prefieren los campos estructurados de tamaño y unidades cuando difieren del nombre original. Consulta [catalog/README.md](catalog/README.md) para el origen, las reglas de normalización y las discrepancias de YG002 y YG004.

Las rutas y los campos principales de JSON conservan sus nombres (`/products`, `productId`, `totalAmount`, etc.). Los atributos `size` y `color` se sustituyen por `presentation` y `brand`, también en los filtros. Los productos incluyen `currency: "MXN"`; en los recibos, `paymentSummary.currency` indica la moneda de todos los importes.

## Imágenes

Cada producto incluye `imageUrl`, una ruta como `/images/products/YG001.webp` relativa al origen de la API. Las 39 imágenes del CSV se descargan previamente y se sirven desde la misma aplicación como archivos WebP de 512 × 512 píxeles, sin autenticación, dependencias de almacenamiento externo en ejecución ni llamadas de IA durante las solicitudes. Se incluyen en la imagen Docker.

Las imágenes activas provienen de los enlaces `imageURL` del CSV y se optimizan con Pillow. Son ilustrativas; los nombres, precios y presentaciones normalizados del catálogo son la referencia de compra. Para restaurar imágenes faltantes, ejecuta `uv run --locked python sync_catalog_images.py`; no requiere claves ni genera cargos de IA.

La generación con OpenAI se conserva como opción futura y no se utiliza para las imágenes activas. Para generar imágenes nuevas, configura `OPENAI_API_KEY` en tu entorno y ejecuta:

```bash
uv run --locked python generate_product_images.py
```

El script conserva los archivos existentes. Puedes seleccionar un producto con `--product-id YG001` y regenerarlo explícitamente con `--overwrite`. La generación utiliza la API de OpenAI (`gpt-image-1.5` por defecto) y tiene un costo; no se ejecuta al instalar, iniciar, probar ni construir la aplicación. Las credenciales y Pillow no son necesarios en producción. Nunca guardes la clave en el repositorio.

## Pagos

La pasarela de pago es de prueba: **no realiza cargos reales**. Usa únicamente datos ficticios, por ejemplo la tarjeta `1111222233334444` y el PIN `4444`. El PIN debe coincidir con los últimos cuatro dígitos de la tarjeta. **No envíes tarjetas ni NIP bancarios reales.** Estas reglas también aparecen en la operación de pago del esquema OpenAPI.

## Estructura y almacenamiento

- `main.py`: aplicación FastAPI y registro de rutas.
- `api_documentation.py`: guía de integración, parámetros y ejemplos del esquema OpenAPI.
- `openapi.json`: contrato generado con `make openapi`.
- `static/products/`: imágenes WebP servidas en `/images/products/`.
- `generate_product_images.py`: generación de imágenes opcional, solo en desarrollo.
- `sync_catalog_images.py`: copia local y optimización de las imágenes del CSV.
- `catalog/`: CSV de origen, traducciones y decisiones de normalización.
- `data.py`: carga del catálogo local y carritos en memoria.
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

La API queda disponible en `http://localhost:8000`.
