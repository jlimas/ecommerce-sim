import csv
import json
from pathlib import Path

from models import Product, ProductAttributes

CATALOG_DIR = Path(__file__).resolve().parent / "catalog"


def load_products() -> list[dict]:
    """Carga el catálogo local de Arkanoid con SKU, precios en MXN y textos en español de México."""
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
            if row["moneda"].strip() != localization["currency"]:
                raise ValueError(f"Moneda no admitida para {sku}: {row['moneda']!r}")
            product = Product(
                id=sku,
                name=row["nombre"].strip(),
                description=row["descripcion"].strip(),
                price=float(row["precio_oferta_mxn"]),
                list_price=float(row["precio_lista_mxn"]),
                discount_percent=int(row["descuento_pct"]),
                currency=localization["currency"],
                image_url=f"/images/products/{sku}.webp",
                stock=int(row["stock"]),
                tags=[tag.strip() for tag in row["tags"].split("|") if tag.strip()],
                attributes=ProductAttributes(
                    brand=row["marca"].strip(),
                    platform=row["plataforma"].strip(),
                    category=localization["categories"][row["categoria"].strip()],
                ),
            )
            products.append(product.model_dump(by_alias=True))
    return products


PRODUCTS = load_products()

# Estado en memoria: se vacía al reiniciar la aplicación.
CARTS: dict[str, list[dict]] = {}
