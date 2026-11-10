import io
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

from data import CARTS, PRODUCTS
from main import app


class StoreAPITests(unittest.TestCase):
    def setUp(self) -> None:
        CARTS.clear()
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.addCleanup(CARTS.clear)
        self.cart_url = "/cart/cliente123"
        self.payment_url = "/payments/cliente123"
        self.payment = {"creditCardNumber": "1111222233334444", "pin": "4444"}

    def add_product(self, product_id: str = "45467911", quantity: int = 1) -> None:
        response = self.client.post(self.cart_url, json={"productId": product_id, "quantity": quantity})
        self.assertEqual(response.status_code, 200, response.text)

    def test_root(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Arkanoid", response.json()["message"])
        self.assertEqual(response.json()["openapiUrl"], "/openapi.json")

    def test_catalog(self) -> None:
        response = self.client.get("/products")
        self.assertEqual(response.status_code, 200)
        products = response.json()
        self.assertEqual(len(products), 60)
        self.assertEqual(len({p["id"] for p in products}), 60)
        self.assertEqual(products, self.client.get("/products").json())
        for product in products:
            self.assertEqual(product["currency"], "MXN")
            self.assertGreater(product["price"], 0)
            self.assertGreaterEqual(product["listPrice"], product["price"])
            self.assertTrue(product["tags"])
            self.assertEqual(set(product["attributes"]), {"brand", "platform", "category"})
            self.assertEqual(
                set(product),
                {
                    "id",
                    "name",
                    "description",
                    "price",
                    "listPrice",
                    "discountPercent",
                    "currency",
                    "imageUrl",
                    "tags",
                    "attributes",
                },
            )
        self.assertEqual(products[0]["name"], "Bundle Nintendo Switch 2 + Mario Kart World")
        self.assertEqual(products[0]["price"], 13419.12)
        self.assertEqual(products[0]["listPrice"], 15249.0)
        self.assertEqual(products[0]["discountPercent"], 12)

    def test_combined_filters(self) -> None:
        response = self.client.get(
            "/products",
            params={
                "brand": "nintendo",
                "platform": "NINTENDO SWITCH 2",
                "category": "consolas",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual([p["id"] for p in response.json()], ["44668140", "44668109"])

    def test_platform_filter_is_exact_and_ignores_accents(self) -> None:
        response = self.client.get("/products", params={"platform": "pc portatil"})
        self.assertEqual([p["id"] for p in response.json()], ["45353663"])
        switch = self.client.get("/products", params={"platform": "Nintendo Switch"}).json()
        self.assertEqual({p["attributes"]["platform"] for p in switch}, {"Nintendo Switch"})
        self.assertEqual(len(switch), 13)

    def test_no_filter_matches(self) -> None:
        self.assertEqual(self.client.get("/products", params={"brand": "Inexistente"}).json(), [])

    def test_search(self) -> None:
        for query, product_id in [
            ("POKEMON", "45276185"),
            ("pokémon", "45276185"),
            ("45021115", "45021115"),
            ("barrel roll", "45467911"),
            ("multijugador", "39548778"),
            ("mundo-abierto", "44696109"),
        ]:
            with self.subTest(query=query):
                response = self.client.get("/products/search", params={"q": query})
                self.assertEqual(response.status_code, 200)
                self.assertIn(product_id, [p["id"] for p in response.json()])

    def test_search_validation(self) -> None:
        self.assertEqual(self.client.get("/products/search", params={"q": "ab"}).status_code, 422)
        self.assertEqual(self.client.get("/products/search").status_code, 422)
        self.assertEqual(self.client.get("/products/search", params={"q": "inexistente"}).json(), [])

    def test_product_detail(self) -> None:
        response = self.client.get("/products/45467911")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Star Fox Nintendo Switch 2")
        self.assertIn(response.json(), self.client.get("/products").json())
        missing = self.client.get("/products/00000000")
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.json()["detail"], "Producto no encontrado")

    def test_all_product_images_are_available(self) -> None:
        for product in self.client.get("/products").json():
            with self.subTest(product_id=product["id"]):
                self.assertEqual(product["imageUrl"], f"/images/products/{product['id']}.webp")
                response = self.client.get(product["imageUrl"])
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["content-type"], "image/webp")
                self.assertLess(len(response.content), 100_000)
                with Image.open(io.BytesIO(response.content)) as image:
                    self.assertEqual(image.format, "WEBP")
                    self.assertEqual(image.size, (512, 512))
                    image.verify()

    def test_image_conditional_request(self) -> None:
        response = self.client.get("/images/products/45467911.webp")
        cached = self.client.get("/images/products/45467911.webp", headers={"If-None-Match": response.headers["etag"]})
        self.assertEqual(cached.status_code, 304)
        self.assertEqual(cached.content, b"")

    def test_images_do_not_expose_other_files(self) -> None:
        for path in (
            "/images/products/00000000.webp",
            "/images/products/",
            "/images/products/%2e%2e/%2e%2e/models.py",
        ):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)

    def test_cart_lifecycle(self) -> None:
        self.assertEqual(self.client.get(self.cart_url).json(), [])
        self.add_product(quantity=2)
        self.add_product()
        self.assertEqual(self.client.get(self.cart_url).json(), [{"productId": "45467911", "quantity": 3}])
        updated = self.client.put(f"{self.cart_url}/45467911", json={"quantity": 5})
        self.assertEqual(updated.json(), [{"productId": "45467911", "quantity": 5}])
        self.assertEqual(self.client.delete(f"{self.cart_url}/45467911").json(), [])

    def test_cart_zero_or_negative_removes_product(self) -> None:
        for quantity in (0, -1):
            with self.subTest(quantity=quantity):
                self.add_product()
                response = self.client.put(f"{self.cart_url}/45467911", json={"quantity": quantity})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), [])

    def test_cart_errors(self) -> None:
        self.assertEqual(
            self.client.post(self.cart_url, json={"productId": "00000000", "quantity": 1}).status_code, 404
        )
        for quantity in (0, -1):
            response = self.client.post(self.cart_url, json={"productId": "45467911", "quantity": quantity})
            self.assertEqual(response.status_code, 422)
        for method in (self.client.put, self.client.delete):
            kwargs = {"json": {"quantity": 1}} if method == self.client.put else {}
            self.assertEqual(method("/cart/otro/45467911", **kwargs).status_code, 404)
            self.assertEqual(method(f"{self.cart_url}/45467911", **kwargs).status_code, 404)

    def test_carts_are_separate(self) -> None:
        self.add_product()
        self.assertEqual(self.client.get("/cart/otro").json(), [])

    def test_payment_receipt_in_mxn(self) -> None:
        self.add_product(quantity=2)
        self.add_product("45000236", quantity=3)
        response = self.client.post(self.payment_url, json=self.payment)
        self.assertEqual(response.status_code, 200, response.text)
        receipt = response.json()
        self.assertEqual(receipt["status"], "success")
        self.assertEqual(receipt["message"], "Pago procesado correctamente.")
        self.assertTrue(receipt["ticketId"].startswith("TICKET-"))
        self.assertEqual(receipt["paymentSummary"]["currency"], "MXN")
        self.assertEqual(receipt["paymentSummary"]["totalAmount"], 4285.7)
        self.assertEqual(receipt["paymentSummary"]["paymentMethod"]["card"], "**** **** **** 4444")
        self.assertNotIn(self.payment["creditCardNumber"], response.text)
        self.assertEqual(
            receipt["purchasedItems"][0],
            {
                "productId": "45467911",
                "name": "Star Fox Nintendo Switch 2",
                "unitPrice": 1199.2,
                "quantity": 2,
                "totalPrice": 2398.4,
            },
        )
        self.assertEqual(receipt["purchasedItems"][1]["totalPrice"], 1887.3)
        self.assertEqual(self.client.get(self.cart_url).json(), [])
        self.assertEqual(self.client.post(self.payment_url, json=self.payment).status_code, 400)

    def test_payment_centavo_arithmetic(self) -> None:
        with patch.dict(PRODUCTS[0], price=19.99):
            self.add_product(PRODUCTS[0]["id"], quantity=3)
            response = self.client.post(self.payment_url, json=self.payment)
            self.assertEqual(response.status_code, 200)
            receipt = response.json()
            self.assertEqual(receipt["paymentSummary"]["totalAmount"], 59.97)
            self.assertEqual(receipt["purchasedItems"][0]["totalPrice"], 59.97)

    def test_invalid_payment_preserves_cart(self) -> None:
        self.add_product()
        for payment, detail in [
            ({**self.payment, "pin": "0000"}, "PIN de prueba no válido"),
            ({**self.payment, "creditCardNumber": "abc"}, "Formato de tarjeta no válido"),
            ({**self.payment, "creditCardNumber": "123"}, "Formato de tarjeta no válido"),
        ]:
            with self.subTest(payment=payment):
                response = self.client.post(self.payment_url, json=payment)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["detail"], detail)
                self.assertEqual(self.client.get(self.cart_url).json(), [{"productId": "45467911", "quantity": 1}])

    def test_empty_cart_payment(self) -> None:
        for initialize in (False, True):
            with self.subTest(initialize=initialize):
                if initialize:
                    self.client.get(self.cart_url)
                response = self.client.post(self.payment_url, json=self.payment)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["detail"], "El carrito está vacío o no existe")

    def test_spaced_card(self) -> None:
        self.add_product()
        response = self.client.post(self.payment_url, json={**self.payment, "creditCardNumber": "1111 2222 3333 4444"})
        self.assertEqual(response.status_code, 200)

    def test_payment_request_validation(self) -> None:
        self.add_product()
        self.assertEqual(self.client.post(self.payment_url, json={}).status_code, 422)
        self.assertEqual(len(self.client.get(self.cart_url).json()), 1)

    def test_openapi(self) -> None:
        response = self.client.get("/openapi.json")
        self.assertEqual(response.status_code, 200)
        schema = response.json()
        self.assertEqual(schema["info"]["title"], "Arkanoid")
        self.assertIn("MXN", schema["info"]["description"])
        filters = {p["name"] for p in schema["paths"]["/products"]["get"]["parameters"]}
        self.assertEqual(filters, {"brand", "platform", "category"})
        payment_docs = schema["paths"]["/payments/{user_id}"]["post"]["description"]
        self.assertIn("mock", payment_docs)
        self.assertIn("no realiza cargos reales", payment_docs)
        self.assertIn("No envíes tarjetas ni NIP bancarios reales", payment_docs)
        for name in ("Product", "PaymentSummary"):
            self.assertEqual(schema["components"]["schemas"][name]["properties"]["currency"]["const"], "MXN")
        for path, operations in schema["paths"].items():
            if not path.startswith("/payments"):
                self.assertNotIn("mock", str(operations).lower())
                self.assertNotIn("simulat", str(operations).lower())

    def test_exported_openapi_matches_live_schema(self) -> None:
        exported = json.loads(Path(__file__).resolve().parents[1].joinpath("openapi.json").read_text(encoding="utf-8"))
        self.assertEqual(exported, self.client.get("/openapi.json").json(), "Regenera el esquema con make openapi")

    def test_all_operations_have_integration_documentation(self) -> None:
        schema = self.client.get("/openapi.json").json()
        operations = [operation for methods in schema["paths"].values() for operation in methods.values()]
        self.assertEqual(
            {operation["operationId"] for operation in operations},
            {
                "listProducts",
                "searchProducts",
                "getProduct",
                "getCart",
                "addToCart",
                "updateCartItem",
                "removeFromCart",
                "payCart",
            },
        )
        for operation in operations:
            self.assertIn("description", operation)
            self.assertTrue(operation["responses"]["200"]["content"]["application/json"]["examples"])
            self.assertIn("schema", operation["responses"]["422"]["content"]["application/json"])
            for parameter in operation.get("parameters", []):
                self.assertIn("description", parameter)

    def test_documented_payment_request_examples(self) -> None:
        schema = self.client.get("/openapi.json").json()
        operation = schema["paths"]["/payments/{user_id}"]["post"]
        examples = operation["requestBody"]["content"]["application/json"]["examples"]
        for name, example in examples.items():
            with self.subTest(name=name):
                CARTS.clear()
                self.add_product(quantity=2)
                response = self.client.post(self.payment_url, json=example["value"])
                if name == "pinIncorrecto":
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(response.json()["detail"], "PIN de prueba no válido")
                    self.assertEqual(self.client.get(self.cart_url).json(), [{"productId": "45467911", "quantity": 2}])
                else:
                    self.assertEqual(response.status_code, 200)
                    receipt_example = operation["responses"]["200"]["content"]["application/json"]["examples"]
                    expected = receipt_example["compraDeDosPiezas"]["value"]
                    self.assertEqual(response.json()["purchasedItems"], expected["purchasedItems"])
                    self.assertEqual(response.json()["paymentSummary"]["totalAmount"], 2398.4)
                    self.assertEqual(self.client.get(self.cart_url).json(), [])


if __name__ == "__main__":
    unittest.main()
