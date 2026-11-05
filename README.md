# Tienda de la Esquina

API de una tienda de conveniencia con catálogo, carrito y recibos de compra. Ofrece bebidas, botanas, galletas, dulces, lácteos, abarrotes y artículos de higiene. El catálogo, la documentación y los mensajes están en español. Todos los precios e importes están en **pesos mexicanos (MXN)**.

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

El catálogo contiene 25 productos con identificadores y precios estables, como Coca-Cola Original de 600 ml a $22.00 MXN y Sabritas Original de 45 g a $19.00 MXN. Los productos incluyen marca, presentación y categoría; se pueden filtrar por estos atributos y buscar sin distinguir mayúsculas ni acentos.

Las rutas y los campos principales de JSON conservan sus nombres (`/products`, `productId`, `totalAmount`, etc.). Los atributos `size` y `color` se sustituyen por `presentation` y `brand`, también en los filtros. Los productos incluyen `currency: "MXN"`; en los recibos, `paymentSummary.currency` indica la moneda de todos los importes.

## Pagos

La pasarela de pago es de prueba: **no realiza cargos reales**. Usa únicamente datos ficticios, por ejemplo la tarjeta `1111222233334444` y el PIN `4444`. El PIN debe coincidir con los últimos cuatro dígitos de la tarjeta. **No envíes tarjetas ni NIP bancarios reales.** Estas reglas también aparecen en la operación de pago del esquema OpenAPI.

## Estructura y almacenamiento

- `main.py`: aplicación FastAPI y registro de rutas.
- `api_documentation.py`: guía de integración, parámetros y ejemplos del esquema OpenAPI.
- `openapi.json`: contrato generado con `make openapi`.
- `data.py`: catálogo fijo y carritos en memoria.
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
