import html
import json
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from data import CARTS
from main import create_site
from web import render_api_page

INDEX_HTML = '<!doctype html><html><body><div id="root"></div></body></html>'


class SiteWithStorefrontTests(unittest.TestCase):
    """The deployed shape: storefront at /, API at /api, legacy API paths at the root."""

    def setUp(self) -> None:
        CARTS.clear()
        self.addCleanup(CARTS.clear)
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dist = Path(tmp.name)
        (self.dist / "index.html").write_text(INDEX_HTML, encoding="utf-8")
        (self.dist / "assets").mkdir()
        (self.dist / "assets" / "index-abc123.js").write_text("console.log('ok')", encoding="utf-8")
        (self.dist / "arkanoid-avatar.png").write_bytes(b"\x89PNG\r\n")
        self.client = TestClient(create_site(self.dist))
        self.addCleanup(self.client.close)

    def assert_storefront(self, response) -> None:
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn('id="root"', response.text)
        self.assertEqual(response.headers["cache-control"], "no-cache")

    def test_root_serves_storefront(self) -> None:
        self.assert_storefront(self.client.get("/"))

    def test_client_side_routes_fall_back_to_index(self) -> None:
        for path in ("/catalogo", "/catalogo/45467911", "/pago", "/historia", "/no/existe", "/cartera", "/apix"):
            with self.subTest(path=path):
                self.assert_storefront(self.client.get(path))

    def test_head_on_storefront(self) -> None:
        response = self.client.head("/ubicaciones")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

    def test_hashed_assets_are_immutable(self) -> None:
        response = self.client.get("/assets/index-abc123.js")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, "console.log('ok')")
        self.assertIn("immutable", response.headers["cache-control"])

    def test_public_files_are_served(self) -> None:
        response = self.client.get("/arkanoid-avatar.png")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "image/png")

    def test_missing_asset_is_404_not_html(self) -> None:
        response = self.client.get("/assets/index-old999.js")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Archivo no encontrado"})

    def test_storefront_does_not_expose_files_outside_dist(self) -> None:
        for path in ("/../main.py", "/%2e%2e/main.py", "/assets/../../main.py"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertNotIn("FastAPI", response.text)

    def test_storefront_rejects_writes(self) -> None:
        response = self.client.post("/catalogo", json={})
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.headers["allow"], "GET, HEAD")

    def test_api_root_under_prefix(self) -> None:
        for path in ("/api", "/api/"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn("Arkanoid", response.json()["message"])
                self.assertEqual(response.json()["openapiUrl"], "/api/openapi.json")

    def test_api_operations_under_prefix(self) -> None:
        self.assertEqual(len(self.client.get("/api/products").json()), 60)
        self.assertEqual(self.client.get("/api/products/45467911").json()["id"], "45467911")
        cart = self.client.post("/api/cart/cliente123", json={"productId": "45467911", "quantity": 2})
        self.assertEqual(cart.json(), [{"productId": "45467911", "quantity": 2}])
        receipt = self.client.post(
            "/api/payments/cliente123", json={"creditCardNumber": "1111222233334444", "pin": "4444"}
        )
        self.assertEqual(receipt.status_code, 200, receipt.text)
        self.assertEqual(receipt.json()["paymentSummary"]["totalAmount"], 2398.4)

    def test_query_cleanup_applies_under_prefix(self) -> None:
        response = self.client.get("/api/products?category=null&platform=")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()), 60)

    def test_api_errors_stay_json_under_prefix(self) -> None:
        missing = self.client.get("/api/products/detail")
        self.assertEqual(missing.status_code, 404)
        self.assertTrue(missing.json()["detail"].startswith("Producto no encontrado"))
        unknown = self.client.get("/api/no-existe")
        self.assertEqual(unknown.status_code, 404)
        self.assertEqual(unknown.headers["content-type"], "application/json")

    def test_openapi_and_docs_under_prefix(self) -> None:
        schema = self.client.get("/api/openapi.json").json()
        self.assertEqual(schema["servers"][0]["url"], "/api")
        self.assertEqual([s["url"] for s in schema["servers"]], ["/api"])
        self.assertIn("/products", schema["paths"])
        docs = self.client.get("/api/docs")
        self.assertEqual(docs.status_code, 200)
        self.assertIn("/api/openapi.json", docs.text)

    def test_images_under_prefix(self) -> None:
        response = self.client.get("/api/images/products/45467911.webp")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "image/webp")

    def test_legacy_root_api_paths_keep_working(self) -> None:
        self.assertEqual(len(self.client.get("/products").json()), 60)
        self.assertEqual(
            len(self.client.get("/products/search?q=mario").json()),
            len(self.client.get("/api/products/search?q=mario").json()),
        )
        self.assertEqual(
            self.client.post("/cart/legacy", json={"productId": "45467911", "quantity": 1}).status_code, 200
        )
        self.assertEqual(self.client.get("/api/cart/legacy").json(), [{"productId": "45467911", "quantity": 1}])
        self.assertEqual(self.client.get("/images/products/45467911.webp").status_code, 200)
        self.assertEqual(self.client.get("/openapi.json").json(), self.client.get("/api/openapi.json").json())
        self.assertEqual(self.client.get("/docs").status_code, 200)
        self.assertEqual(self.client.get("/products/detail").status_code, 404)

    def test_browser_on_api_gets_prerendered_api_page(self) -> None:
        for path in ("/api", "/api/"):
            with self.subTest(path=path):
                response = self.client.get(path, headers={"Accept": "text/html,application/xhtml+xml,*/*;q=0.8"})
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.headers["content-type"].startswith("text/html"))
                self.assertEqual(response.headers["cache-control"], "no-cache")
                page = response.text
                self.assertIn('<div id="root"><main id="api-reference">', page)
                self.assertIn("<code>GET /api/products</code>", page)
                self.assertIn("<code>POST /api/payments/{user_id}</code>", page)
                self.assertIn('href="/api/openapi.json"', page)
                self.assertIn('href="/api/docs"', page)
                self.assertIn('<pre id="openapi-spec">', page)
                self.assertIn('"openapi": "3.', page)

    def test_prerendered_spec_matches_served_schema(self) -> None:
        page = self.client.get("/api", headers={"Accept": "text/html"}).text
        spec_html = page.split('<pre id="openapi-spec">', 1)[1].split("</pre>", 1)[0]
        self.assertEqual(json.loads(html.unescape(spec_html)), self.client.get("/api/openapi.json").json())

    def test_api_clients_still_get_json_at_api_root(self) -> None:
        for accept in ("*/*", "application/json", None):
            with self.subTest(accept=accept):
                headers = {"Accept": accept} if accept else {}
                response = self.client.get("/api", headers=headers)
                self.assertEqual(response.headers["content-type"], "application/json")
                self.assertEqual(response.json()["openapiUrl"], "/api/openapi.json")

    def test_only_api_root_is_negotiated(self) -> None:
        response = self.client.get("/api/products?limit=1", headers={"Accept": "text/html"})
        self.assertEqual(response.headers["content-type"], "application/json")
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(
            self.client.get("/api/openapi.json", headers={"Accept": "text/html"}).json()["info"]["title"], "Arkanoid"
        )

    def test_other_storefront_pages_are_not_prerendered(self) -> None:
        page = self.client.get("/catalogo", headers={"Accept": "text/html"}).text
        self.assertNotIn("api-reference", page)

    def test_api_page_rejects_writes_like_the_api(self) -> None:
        response = self.client.post("/api", headers={"Accept": "text/html"})
        self.assertEqual(response.headers["content-type"], "application/json")
        self.assertEqual(response.status_code, 405)


class SiteWithoutStorefrontTests(unittest.TestCase):
    """Local API-only runs (no `pnpm build`): the root keeps answering with the API."""

    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.client = TestClient(create_site(Path(tmp.name)))
        self.addCleanup(self.client.close)

    def test_root_falls_back_to_api_welcome(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["openapiUrl"], "/openapi.json")

    def test_api_prefix_still_works(self) -> None:
        self.assertEqual(self.client.get("/api").json()["openapiUrl"], "/api/openapi.json")
        self.assertEqual(len(self.client.get("/api/products").json()), 60)

    def test_unknown_root_path_is_api_404(self) -> None:
        response = self.client.get("/catalogo")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.headers["content-type"], "application/json")

    def test_missing_directory_is_api_only(self) -> None:
        client = TestClient(create_site(None))
        self.addCleanup(client.close)
        self.assertEqual(client.get("/").json()["openapiUrl"], "/openapi.json")

    def test_browser_on_api_without_storefront_gets_json(self) -> None:
        response = self.client.get("/api", headers={"Accept": "text/html"})
        self.assertEqual(response.headers["content-type"], "application/json")


class RenderApiPageTests(unittest.TestCase):
    def test_escapes_schema_text(self) -> None:
        schema = {
            "openapi": "3.1.0",
            "info": {"title": "<b>X</b>", "version": "1"},
            "servers": [{"url": "/api"}],
            "paths": {"/a": {"get": {"summary": "<script>alert(1)</script>", "operationId": "op"}}},
        }
        page = render_api_page(schema)
        self.assertNotIn("<script>", page)
        self.assertNotIn("<b>X</b>", page)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", page)
        self.assertIn("<code>GET /api/a</code>", page)

    def test_without_servers_uses_root_paths(self) -> None:
        page = render_api_page({"info": {"title": "T", "version": "1"}, "paths": {"/a": {"post": {}}}})
        self.assertIn("<code>POST /a</code>", page)
        self.assertIn('href="/openapi.json"', page)
