import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import data


class CatalogTests(unittest.TestCase):
    def setUp(self) -> None:
        with (data.CATALOG_DIR / "products.csv").open(encoding="utf-8-sig", newline="") as source:
            self.rows = list(csv.DictReader(source))
        self.products = {product["id"]: product for product in data.PRODUCTS}

    def test_source_skus_prices_and_package_counts_are_preserved(self) -> None:
        self.assertEqual(set(self.products), {row["sku"] for row in self.rows})
        for row in self.rows:
            with self.subTest(sku=row["sku"]):
                product = self.products[row["sku"]]
                self.assertEqual(product["price"], float(row["price"]))
                self.assertEqual(product["unitsPerPackage"], int(row["unitsPerPackage"]))
                self.assertEqual(product["currency"], "MXN")
                self.assertEqual(product["packageType"], "caja")

    def test_structured_fields_resolve_source_conflicts(self) -> None:
        self.assertEqual(self.products["YG002"]["unitsPerPackage"], 3)
        self.assertIn("3 botellas de vidrio de 350 ml", self.products["YG002"]["name"])
        self.assertEqual(self.products["YG004"]["unitsPerPackage"], 5)
        self.assertIn("5 botellas de vidrio de 500 ml", self.products["YG004"]["name"])

    def test_missing_brand_and_active_state_are_filled(self) -> None:
        self.assertEqual(len(self.products), 39)
        self.assertTrue(any(not row["brand"] for row in self.rows))
        self.assertTrue(any(not row["isActive"] for row in self.rows))
        self.assertTrue(all(product["attributes"]["brand"] == "YaGoods" for product in self.products.values()))

    def test_mexican_spanish_localization(self) -> None:
        self.assertIn("limón", self.products["YG003"]["name"])
        self.assertIn("mora azul", self.products["YG018"]["name"])
        self.assertIn("maracuyá", self.products["YG017"]["name"])
        self.assertEqual(self.products["YG022"]["attributes"]["category"], "Botanas")
        for product in self.products.values():
            self.assertTrue(product["description"])
            self.assertTrue(product["attributes"]["presentation"].startswith("Caja con "))
            self.assertNotIn("-pack", product["name"])
            self.assertNotIn("Bottle", product["name"])

    def test_catalog_loads_offline(self) -> None:
        with patch("urllib.request.urlopen", side_effect=AssertionError("Unexpected network access")) as network:
            self.assertEqual(data.load_products(), data.PRODUCTS)
            network.assert_not_called()

    def load_modified_rows(self, rows: list[dict]) -> list[dict]:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            localization = (data.CATALOG_DIR / "localization.json").read_text(encoding="utf-8")
            path.joinpath("localization.json").write_text(localization, encoding="utf-8")
            with path.joinpath("products.csv").open("w", encoding="utf-8", newline="") as output:
                writer = csv.DictWriter(output, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
            with patch.object(data, "CATALOG_DIR", path):
                return data.load_products()

    def test_inactive_products_are_excluded(self) -> None:
        self.rows[0]["isActive"] = "FALSE"
        products = self.load_modified_rows(self.rows)
        self.assertEqual(len(products), 38)
        self.assertNotIn("YG001", {product["id"] for product in products})

    def test_duplicate_skus_fail_early(self) -> None:
        with self.assertRaisesRegex(ValueError, "duplicado"):
            self.load_modified_rows([*self.rows, self.rows[0]])

    def test_localization_has_no_missing_or_extra_products(self) -> None:
        localization = json.loads((data.CATALOG_DIR / "localization.json").read_text(encoding="utf-8"))
        self.assertEqual(set(localization["products"]), set(self.products))


if __name__ == "__main__":
    unittest.main()
