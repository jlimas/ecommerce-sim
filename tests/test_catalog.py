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

    def test_source_skus_and_prices_are_preserved(self) -> None:
        self.assertEqual(len(self.products), 60)
        self.assertEqual(set(self.products), {row["sku"] for row in self.rows})
        for row in self.rows:
            with self.subTest(sku=row["sku"]):
                product = self.products[row["sku"]]
                self.assertEqual(product["name"], row["nombre"])
                self.assertEqual(product["description"], row["descripcion"])
                self.assertEqual(product["price"], float(row["precio_oferta_mxn"]))
                self.assertEqual(product["listPrice"], float(row["precio_lista_mxn"]))
                self.assertEqual(product["discountPercent"], int(row["descuento_pct"]))
                self.assertEqual(product["tags"], row["tags"].split("|"))
                self.assertEqual(product["currency"], "MXN")
                self.assertEqual(product["attributes"]["brand"], row["marca"])
                self.assertEqual(product["attributes"]["platform"], row["plataforma"])

    def test_discounts_match_list_and_offer_prices(self) -> None:
        for product in self.products.values():
            with self.subTest(sku=product["id"]):
                self.assertGreater(product["price"], 0)
                self.assertLessEqual(product["price"], product["listPrice"])
                expected = round((1 - product["price"] / product["listPrice"]) * 100)
                self.assertEqual(product["discountPercent"], expected)

    def test_categories_are_displayed_in_mexican_spanish(self) -> None:
        categories = {product["attributes"]["category"] for product in self.products.values()}
        self.assertEqual(categories, {"Consolas", "Videojuegos", "Accesorios", "Pantallas", "Coleccionables"})
        self.assertEqual(self.products["44668140"]["attributes"]["category"], "Consolas")
        self.assertEqual(self.products["45467911"]["attributes"]["category"], "Videojuegos")
        self.assertEqual(self.products["45467911"]["attributes"]["platform"], "Nintendo Switch 2")
        self.assertIn("Pokémon", self.products["45276185"]["name"])
        for product in self.products.values():
            self.assertTrue(product["description"])
            self.assertTrue(product["tags"])

    def test_demo_roles_are_not_part_of_the_catalog(self) -> None:
        self.assertNotIn("rol_en_demo", self.rows[0])
        for product in self.products.values():
            self.assertNotIn("Carrusel", json.dumps(product, ensure_ascii=False))

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
        rows = [{**row, "isActive": ""} for row in self.rows]
        rows[0]["isActive"] = "FALSE"
        products = self.load_modified_rows(rows)
        self.assertEqual(len(products), 59)
        self.assertNotIn(self.rows[0]["sku"], {product["id"] for product in products})

    def test_unsupported_currency_fails_early(self) -> None:
        with self.assertRaisesRegex(ValueError, "Moneda"):
            self.load_modified_rows([{**self.rows[0], "moneda": "USD"}, *self.rows[1:]])

    def test_duplicate_skus_fail_early(self) -> None:
        with self.assertRaisesRegex(ValueError, "duplicado"):
            self.load_modified_rows([*self.rows, self.rows[0]])

    def test_localization_has_no_missing_or_extra_categories(self) -> None:
        localization = json.loads((data.CATALOG_DIR / "localization.json").read_text(encoding="utf-8"))
        self.assertEqual(set(localization["categories"]), {row["categoria"] for row in self.rows})


if __name__ == "__main__":
    unittest.main()
