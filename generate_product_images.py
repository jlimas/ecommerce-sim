"""Genera imágenes del catálogo una sola vez; no se ejecuta desde la API."""

import argparse
import base64
import io
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

from data import PRODUCTS

OUTPUT_DIR = Path(__file__).resolve().parent / "static" / "products"
STYLE = (
    "Create a clean, photorealistic e-commerce product packshot for a Mexican video game store. "
    "Show the complete retail product: the console, game case, accessory or screen, "
    "centered and entirely visible, filling about 70 percent of a square canvas. "
    "Seamless warm-white background, soft studio lighting, subtle contact shadow, eye-level front three-quarter view. "
    "Accurate physical proportions and realistic materials. "
    "No hands, people, props, price tags, borders or watermarks. "
    "Use recognizable packaging colors and the brand name, with simple legible package lettering, not dense tiny text. "
    "An illustrative product rendering, not an official manufacturer photograph. "
)


def generate_image(product: dict, model: str) -> None:
    """Solicita un packshot y guarda únicamente el WebP optimizado, nunca credenciales."""
    prompt = (
        f"{STYLE}\nProduct: {product['name']}. {product['description']}\n"
        f"Brand: {product['attributes']['brand']}. Platform: {product['attributes']['platform']}. "
        f"Category: {product['attributes']['category']}."
    )
    payload = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
        "quality": "low",
        "output_format": "webp",
        "output_compression": 85,
    }
    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    request = urllib.request.Request(
        f"{base_url}/images/generations",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        error.close()
        raise RuntimeError(
            f"OpenAI devolvió HTTP {error.code}; no se reintenta para evitar cargos duplicados."
        ) from None

    image_bytes = base64.b64decode(result["data"][0]["b64_json"], validate=True)
    with Image.open(io.BytesIO(image_bytes)) as image:
        image = image.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
        output = OUTPUT_DIR / f"{product['id']}.webp"
        temporary = output.with_suffix(".tmp")
        image.save(temporary, format="WEBP", quality=82, method=6)
        temporary.replace(output)
    print(f"Generada {output.name}: {output.stat().st_size:,} bytes", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--product-id", action="append", help="Generar solo este producto; se puede repetir")
    parser.add_argument("--model", default="gpt-image-1.5", help="Modelo de imágenes de OpenAI")
    parser.add_argument("--overwrite", action="store_true", help="Volver a generar imágenes existentes (genera cargos)")
    args = parser.parse_args()
    if not os.environ.get("OPENAI_API_KEY"):
        parser.error("Configura OPENAI_API_KEY en el entorno. Nunca la guardes en el repositorio.")
    requested = set(args.product_id or [p["id"] for p in PRODUCTS])
    unknown = requested - {p["id"] for p in PRODUCTS}
    if unknown:
        parser.error(f"Productos desconocidos: {', '.join(sorted(unknown))}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for product in PRODUCTS:
        if product["id"] not in requested:
            continue
        if (OUTPUT_DIR / f"{product['id']}.webp").exists() and not args.overwrite:
            print(f"Se conserva {product['id']}.webp", flush=True)
            continue
        generate_image(product, args.model)


if __name__ == "__main__":
    main()
