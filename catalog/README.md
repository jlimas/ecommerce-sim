# Origen y normalización del catálogo

`products.csv` es una copia del archivo `seeds/products.csv` de `yalochat/ml-gai-service`, revisión `8237bac39724011db42f47a8e1c8b9791233530a`. No se conserva ningún token de acceso.

`localization.json` contiene los nombres, descripciones y categorías en español de México. El SKU original se usa como `id`; se conservan los valores numéricos de `price`, `size` y `unitsPerPackage`.

## Decisiones para completar los datos

- **Moneda:** el CSV no incluye una moneda ni un tipo de cambio. Los precios numéricos se interpretan como MXN; no se realiza una conversión de divisas supuesta.
- **Precio y cantidades:** `price` es el precio de una caja completa. `quantity` cuenta cajas y `unitsPerPackage` indica cuántas unidades contiene una caja. Por ejemplo, dos cajas de YG001 cuestan $250.00 MXN y contienen ocho botellas.
- **Marca:** se completa la marca vacía con `YaGoods`, la marca del catálogo indicada en la primera fila. Se normaliza su escritura para todos los productos.
- **Disponibilidad:** `isActive` vacío se interpreta como `true`. No se inventan existencias, fechas de vencimiento, certificaciones ni promociones.
- **Empaque:** `box` se muestra como `caja`; la presentación en español incorpora el tipo de envase, contenido y unidades por caja.
- **YG002:** el nombre original dice 4-pack, pero `unitsPerPackage` indica 3; se utiliza **3 botellas de 350 ml**.
- **YG004:** el nombre original dice 350 ml y 4-pack, pero `size` y `unitsPerPackage` indican 500 ml y 5; se utiliza **5 botellas de 500 ml**.
- **Categorías:** el grupo original `Natural juices` también contiene leche y té; se muestra como `Jugos y bebidas` para no describirlos incorrectamente como jugos naturales.
- **Descripciones:** se traducen al español de México y se evitan afirmaciones nutricionales contradictorias o certificaciones no verificadas de las etiquetas originales.
- **Imágenes:** se usan los enlaces `imageURL` del CSV, descargados y optimizados como WebP de 512 × 512 en `static/products/`. Son ilustrativas; sus envases pueden no reflejar exactamente las cantidades estructuradas del catálogo.

La API carga únicamente archivos locales: iniciar el servidor no requiere acceso a GitHub, Google Cloud ni OpenAI. `uv run --locked python sync_catalog_images.py` restaura imágenes faltantes desde los enlaces públicos del CSV.

`generate_product_images.py` se conserva como alternativa opcional para generar imágenes futuras con OpenAI, pero no se usa para las imágenes activas de este catálogo. No reemplaza archivos existentes sin `--overwrite`.
