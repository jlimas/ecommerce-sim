import json
import logging
import unittest

from fastapi.testclient import TestClient

from app_logging import NotFoundAccessFilter
from data import CARTS
from main import app


def access_record(status: int) -> logging.LogRecord:
    return logging.LogRecord(
        "uvicorn.access",
        logging.INFO,
        __file__,
        0,
        '%s - "%s %s HTTP/%s" %d',
        ("10.0.1.46:43680", "GET", "/.env", "1.1", status),
        None,
    )


class LoggingTests(unittest.TestCase):
    def setUp(self) -> None:
        CARTS.clear()
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.addCleanup(CARTS.clear)

    def events(self, logs: list[str]) -> list[tuple[str, dict]]:
        events = []
        for line in logs:
            operation, _, payload = line.split(":", 2)[2].partition(" ")
            events.append((operation, json.loads(payload)))
        return events

    def test_access_log_hides_404_only(self) -> None:
        access_filter = NotFoundAccessFilter()
        self.assertFalse(access_filter.filter(access_record(404)))
        self.assertTrue(access_filter.filter(access_record(200)))
        self.assertTrue(access_filter.filter(access_record(400)))
        self.assertTrue(any(isinstance(f, NotFoundAccessFilter) for f in logging.getLogger("uvicorn.access").filters))

    def test_unmatched_routes_are_not_logged_as_operations(self) -> None:
        with self.assertNoLogs("arkanoid"):
            self.assertEqual(self.client.get("/.env").status_code, 404)

    def test_product_queries_are_logged_with_raw_and_resolved_values(self) -> None:
        with self.assertLogs("arkanoid", "INFO") as logs:
            self.client.get("/products", params={"platform": "Switch 2", "brand": "null", "maxPrice": "$1,800"})
        events = dict(self.events(logs.output))
        self.assertEqual(events["productQueryCleanup"]["cleaned"], "platform=Switch+2&maxPrice=1800")
        self.assertEqual(events["listProducts"]["resolved"]["platform"], ["Nintendo Switch 2"])
        self.assertEqual(events["listProducts"]["params"], {"platform": "Switch 2", "maxPrice": 1800.0})
        self.assertGreater(events["listProducts"]["results"], 0)

    def test_errors_are_logged_as_warnings(self) -> None:
        with self.assertLogs("arkanoid", "WARNING") as logs:
            self.client.get("/products", params={"platform": "Switch 3"})
            self.client.get("/products/999")
            self.client.get("/products/search", params={"q": "ab"})
        statuses = [(operation, event["status"]) for operation, event in self.events(logs.output)]
        self.assertEqual(statuses, [("listProducts", 400), ("getProduct", 404), ("searchProducts", 422)])

    def test_payment_logs_never_contain_card_or_pin(self) -> None:
        self.client.post("/cart/cliente123", json={"productId": "45467911", "quantity": 2})
        with self.assertLogs("arkanoid", "INFO") as logs:
            self.client.post("/payments/cliente123", json={"creditCardNumber": "1111222233334444", "pin": 4444})
            self.client.post("/payments/cliente123", json={"creditCardNumber": "1111222233334444", "pin": "0000"})
            self.client.post("/payments/cliente123", json={"creditCardNumber": "1111222233334444", "pin": "4444"})
        output = "\n".join(logs.output)
        self.assertNotIn("1111222233334444", output)
        self.assertNotIn("4444", output.replace("TICKET-", ""))
        self.assertIn("payCart", output)
        self.assertIn("2398.4", output)


if __name__ == "__main__":
    unittest.main()
