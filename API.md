# API Documentation

This document provides detailed information about the Ecommerce Simulation API endpoints.

**Base URL:** `http://localhost:8000`

---

## 1. Products API

Handles browsing and searching for products.

### `GET /products`

Retrieves a list of all available products. Can be filtered by product attributes.

*   **Method:** `GET`
*   **Path:** `/products`
*   **Query Parameters:**
    *   `size` (optional, string): Filter by size (e.g., "M", "L").
    *   `color` (optional, string): Filter by color (e.g., "Red").
    *   `category` (optional, string): Filter by category (e.g., "Apparel").
*   **Success Response (200 OK):**
    ```json
    [
      {
        "id": "PRD#1",
        "name": "Synergistic Unaligned Application",
        "description": "Cross-platform scalable array",
        "price": 43.68,
        "attributes": {
          "size": "L",
          "color": "Red",
          "category": "Footwear"
        }
      }
    ]
    ```

### `GET /products/search`

Searches for products by a query string in their name or description.

*   **Method:** `GET`
*   **Path:** `/products/search`
*   **Query Parameters:**
    *   `q` (required, string): The search term. Must be at least 3 characters.
*   **Success Response (200 OK):** (Same structure as `GET /products`)

### `GET /products/{product_id}`

Retrieves a single product by its unique ID.

*   **Method:** `GET`
*   **Path:** `/products/{product_id}`
*   **Path Parameters:**
    *   `product_id` (required, string): The ID of the product (e.g., "PRD#1").
*   **Success Response (200 OK):** (Same structure as a single item in `GET /products`)
*   **Error Response (404 Not Found):**
    ```json
    {
      "detail": "Product not found"
    }
    ```

---

## 2. Cart API

Handles all shopping cart operations for a given user.

### `GET /cart/{user_id}`

Retrieves the current state of a user's shopping cart.

*   **Method:** `GET`
*   **Path:** `/cart/{user_id}`
*   **Success Response (200 OK):**
    ```json
    [
      {
        "productId": "PRD#1",
        "quantity": 2
      }
    ]
    ```

### `POST /cart/{user_id}`

Adds a product to the user's cart. If the product is already in the cart, its quantity is increased.

*   **Method:** `POST`
*   **Path:** `/cart/{user_id}`
*   **Request Body:**
    ```json
    {
      "productId": "PRD#1",
      "quantity": 1
    }
    ```
*   **Success Response (200 OK):** (Returns the updated cart)
*   **Error Response (404 Not Found):** If `productId` does not exist.

### `PUT /cart/{user_id}/{product_id}`

Updates the quantity of a specific product in the cart. If quantity is set to 0 or less, the item is removed.

*   **Method:** `PUT`
*   **Path:** `/cart/{user_id}/{product_id}`
*   **Request Body:**
    ```json
    {
      "quantity": 3
    }
    ```
*   **Success Response (200 OK):** (Returns the updated cart)
*   **Error Response (404 Not Found):** If user cart or product in cart does not exist.

### `DELETE /cart/{user_id}/{product_id}`

Removes a product entirely from the user's cart.

*   **Method:** `DELETE`
*   **Path:** `/cart/{user_id}/{product_id}`
*   **Success Response (200 OK):** (Returns the updated cart)

---

## 3. Payments API

Handles the final payment processing step.

### `POST /payments/{user_id}`

Processes the payment for a user's entire cart.

*   **Method:** `POST`
*   **Path:** `/payments/{user_id}`
*   **Validation Rule:** The `pin` must be the last 4 digits of the `creditCardNumber`.
*   **Request Body:**
    ```json
    {
      "creditCardNumber": "1111222233334444",
      "pin": "4444"
    }
    ```
*   **Success Response (200 OK):** Returns a full transaction receipt.
    ```json
    {
      "status": "success",
      "message": "Payment processed successfully.",
      "ticketId": "TICKET-a1b2c3d4-...",
      "paymentSummary": {
        "totalAmount": 131.04,
        "paymentMethod": {
          "card": "**** **** **** 4444"
        }
      },
      "purchasedItems": [
        {
          "productId": "PRD#1",
          "name": "Synergistic Unaligned Application",
          "unitPrice": 43.68,
          "quantity": 3,
          "totalPrice": 131.04
        }
      ]
    }
    ```
*   **Error Responses:**
    *   **400 Bad Request:** If the cart is empty or the PIN is invalid.
    ```json
    {
      "detail": "Cart is empty or does not exist"
    }
    ```
    ```json
    {
      "detail": "Invalid PIN"
    }
    ```
