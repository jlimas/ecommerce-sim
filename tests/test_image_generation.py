import base64
import io
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from PIL import Image

import generate_product_images
from data import PRODUCTS

PRODUCT_ID = PRODUCTS[0]["id"]


class ImageGenerationTests(unittest.TestCase):
    def test_all_products_have_generation_details(self) -> None:
        for product in PRODUCTS:
            self.assertTrue(product["name"])
            self.assertTrue(product["attributes"]["platform"])
            self.assertTrue(product["attributes"]["category"])

    def test_existing_images_are_not_regenerated(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            existing = output_dir / f"{PRODUCT_ID}.webp"
            existing.write_bytes(b"existing-image")
            with (
                patch.object(generate_product_images, "OUTPUT_DIR", output_dir),
                patch.object(generate_product_images, "generate_image") as generate,
                patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}),
                patch("sys.argv", ["generate_product_images.py", "--product-id", PRODUCT_ID]),
            ):
                generate_product_images.main()
            generate.assert_not_called()
            self.assertEqual(existing.read_bytes(), b"existing-image")

    def test_explicit_overwrite_regenerates_selected_product_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch.object(generate_product_images, "OUTPUT_DIR", Path(directory)),
                patch.object(generate_product_images, "generate_image") as generate,
                patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}),
                patch("sys.argv", ["generate_product_images.py", "--product-id", PRODUCT_ID, "--overwrite"]),
            ):
                generate_product_images.main()
            generate.assert_called_once_with(PRODUCTS[0], "gpt-image-1.5")

    def test_provider_image_is_resized_and_saved_as_webp(self) -> None:
        image_bytes = io.BytesIO()
        Image.new("RGB", (1024, 1024), "white").save(image_bytes, format="PNG")
        encoded = base64.b64encode(image_bytes.getvalue()).decode()
        response = io.BytesIO(json.dumps({"data": [{"b64_json": encoded}]}).encode())
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch.object(generate_product_images, "OUTPUT_DIR", Path(directory)),
                patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}),
                patch.object(generate_product_images.urllib.request, "urlopen", return_value=response) as urlopen,
            ):
                generate_product_images.generate_image(PRODUCTS[0], "gpt-image-1.5")
            request = urlopen.call_args.args[0]
            payload = json.loads(request.data)
            self.assertEqual(payload["model"], "gpt-image-1.5")
            self.assertEqual(payload["quality"], "low")
            self.assertIn(PRODUCTS[0]["name"], payload["prompt"])
            with Image.open(Path(directory) / f"{PRODUCT_ID}.webp") as image:
                self.assertEqual(image.size, (512, 512))
                self.assertEqual(image.format, "WEBP")

    def test_provider_errors_are_not_retried(self) -> None:
        error = urllib.error.HTTPError("https://api.openai.com/v1/images/generations", 429, "Rate limited", {}, None)
        with (
            patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}),
            patch.object(generate_product_images.urllib.request, "urlopen", side_effect=error) as urlopen,
        ):
            with self.assertRaisesRegex(RuntimeError, "HTTP 429"):
                generate_product_images.generate_image(PRODUCTS[0], "gpt-image-1.5")
            self.assertEqual(urlopen.call_count, 1)


if __name__ == "__main__":
    unittest.main()
