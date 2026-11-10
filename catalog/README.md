# Origen y normalización del catálogo

`products.csv` es el catálogo de videojuegos de Arkanoid: 60 productos con SKU, nombre, marca, plataforma, categoría, precio de lista, precio de oferta, descuento, descripción y etiquetas. Los datos de producto, precios e imágenes de referencia se consultaron en elpalaciodehierro.com el 2026-11-10; las columnas `imagen_url` y `url_producto` conservan ese origen y no se exponen en la API.

`localization.json` define la moneda, el estado activo por defecto y el nombre visible de cada categoría. Los nombres y descripciones ya vienen en español de México y se usan sin cambios.

## Decisiones para completar los datos

- **Tienda:** el catálogo se publica con la marca Arkanoid. La API no menciona la tienda de origen ni enlaza a sus páginas de producto.
- **Columnas omitidas:** la columna `rol_en_demo` del archivo original no forma parte del catálogo y se eliminó de `products.csv`.
- **Moneda:** todos los renglones indican `MXN`. Un valor distinto en `moneda` detiene la carga; no se realiza conversión de divisas.
- **Precio:** `price` es `precio_oferta_mxn`, el importe que se cobra por pieza. `listPrice` es `precio_lista_mxn` y `discountPercent` es `descuento_pct`; ambos son informativos. Las pruebas verifican que el descuento corresponda a ambos precios.
- **Cantidades:** `quantity` cuenta piezas. Los paquetes (bundles) son una sola pieza; no hay cajas ni unidades por empaque.
- **Existencias:** se eliminó la columna `stock` (25 piezas por producto en el origen). La tienda no maneja inventario: todos los productos están disponibles en cualquier cantidad.
- **Disponibilidad:** el CSV no incluye `isActive`; todos los productos se consideran activos. Si se agrega esa columna, `FALSE` excluye el producto.
- **Marca:** se conserva `marca` tal como viene. En varios videojuegos y accesorios es la marca de la consola (por ejemplo, Cyberpunk 2077 aparece como Nintendo) o un valor genérico (`Licencias`), no el estudio o editor.
- **Plataforma:** se conserva `plataforma` sin normalizar. `Nintendo Switch` y `Nintendo Switch 2` son valores distintos; también existen `Xbox Series`, `PlayStation 5`, `PC portátil`, `TV`, `Multiplataforma`, `Coleccionable` y `Nintendo`.
- **Categorías:** `consola`, `videojuego`, `accesorio`, `pantalla` y `coleccionable` se muestran como `Consolas`, `Videojuegos`, `Accesorios`, `Pantallas` y `Coleccionables`.
- **Etiquetas:** `tags` se separa por `|` y se publica sin cambios, incluidas etiquetas comerciales como `upsell` y `set-completo`. La búsqueda también las consulta.
- **Preventas:** los productos con la etiqueta `preventa` se venden como cualquier otro; el catálogo no incluye fechas de lanzamiento ni de entrega.
- **Imágenes:** se usan los enlaces `imagen_url` del CSV, descargados y optimizados como WebP de 512 × 512 en `static/products/`. Son ilustrativas.

La API carga únicamente archivos locales: iniciar el servidor no requiere acceso a sitios externos ni a OpenAI. `uv run --locked python sync_catalog_images.py` restaura imágenes faltantes desde los enlaces del CSV.

`generate_product_images.py` se conserva como alternativa opcional para generar imágenes futuras con OpenAI, pero no se usa para las imágenes activas de este catálogo. No reemplaza archivos existentes sin `--overwrite`.
