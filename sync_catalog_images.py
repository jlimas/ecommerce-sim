"""Descarga las imágenes del CSV y crea copias WebP locales; no utiliza IA ni requiere claves."""

import csv
import io
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

from data import CATALOG_DIR, PRODUCTS

OUTPUT_DIR = Path(__file__).resolve().parent / "static" / "products"
SOURCE_PREFIX = "https://www.elpalaciodehierro.com/on/demandware.static/-/Sites-palacio-master-catalog/"
USER_AGENT = "arkanoid-catalog-sync/1.0"


def main() -> None:
    """Descarga únicamente imágenes faltantes de los productos activos del catálogo."""
    active_skus = {product["id"] for product in PRODUCTS}
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with (CATALOG_DIR / "products.csv").open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            sku = row["sku"].strip()
            if sku not in active_skus:
                continue
            output = OUTPUT_DIR / f"{sku}.webp"
            if output.exists():
                continue
            url = row["imagen_url"].strip()
            if not url.startswith(SOURCE_PREFIX):
                raise ValueError(f"Origen de imagen no permitido para {sku}")
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                content = response.read(10_000_001)
            if len(content) > 10_000_000:
                raise ValueError(f"Imagen demasiado grande para {sku}")
            with Image.open(io.BytesIO(content)) as original:
                image = ImageOps.pad(original.convert("RGB"), (512, 512), color="white")
                temporary = output.with_suffix(".tmp")
                image.save(temporary, format="WEBP", quality=82, method=6)
                temporary.replace(output)
            print(f"Importada {sku}.webp ({output.stat().st_size:,} bytes)", flush=True)


if __name__ == "__main__":
    main()
