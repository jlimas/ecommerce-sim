import csv
import json
import re
from pathlib import Path

from models import Product, ProductAttributes

CATALOG_DIR = Path(__file__).resolve().parent / "catalog"


def load_products() -> list[dict]:
    """Carga el catálogo local con SKU, precio por caja y textos en español de México."""
    localization = json.loads((CATALOG_DIR / "localization.json").read_text(encoding="utf-8"))
    products = []
    seen = set()
    with (CATALOG_DIR / "products.csv").open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            sku = row["sku"].strip()
            if not sku or sku in seen:
                raise ValueError(f"SKU vacío o duplicado en el catálogo: {sku!r}")
            seen.add(sku)
            active = (row.get("isActive") or str(localization["defaultActive"])).strip().casefold()
            if active not in {"true", "false"}:
                raise ValueError(f"isActive no válido para {sku}: {active!r}")
            if active == "false":
                continue
            text = localization["products"][sku]
            size = re.sub(r"(?<=\d)\s*(ml|g)\b", r" \1", row["size"].strip())
            count = int(row["unitsPerPackage"] or 1)
            presentation = f"Caja con {count} {text['container']} de {size}"
            brand = (row.get("brand") or localization["defaultBrand"]).strip()
            if brand.casefold() == localization["defaultBrand"].casefold():
                brand = localization["defaultBrand"]
            product = Product(
                id=sku,
                name=f"{text['name']}, {count} {text['container']} de {size}",
                description=text["description"],
                price=float(row["price"]),
                currency=localization["currency"],
                image_url=f"/images/products/{sku}.webp",
                package_type="caja",
                units_per_package=count,
                attributes=ProductAttributes(
                    brand=brand,
                    presentation=presentation,
                    category=localization["categories"][row["category"]],
                ),
            )
            products.append(product.model_dump(by_alias=True))
    return products


PRODUCTS = load_products()

# Estado en memoria: se vacía al reiniciar la aplicación.
CARTS: dict[str, list[dict]] = {}
