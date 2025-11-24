# Ecommerce Simulation API

This project is a simple, lightweight simulation of an ecommerce backend API built with Python and FastAPI. It provides endpoints for managing products, a shopping cart, and processing payments, all using an in-memory data store.

The entire application is containerized with Docker and managed with a simple `Makefile`.

## Core Technologies

*   **Language:** Python 3.11
*   **Framework:** FastAPI
*   **Server:** Uvicorn
*   **Package Management:** `uv`
*   **Containerization:** Docker

## Architecture Overview

The application is built around the FastAPI framework, which provides a modern, high-performance foundation for the API. It is structured into three main logical components:

1.  **In-Memory Data (`data.py`):** To keep things simple, this project does not use a database. All product data is generated at startup and stored in a global variable. Carts are also stored in a simple in-memory dictionary.
2.  **API Routers (`apis/`):** The API is divided into logical modules for Products, Cart, and Payments. Each module contains its own FastAPI router, keeping the endpoint logic organized and separated.
3.  **Pydantic Models (`models.py`):** All data shapes for requests and responses are strictly defined using Pydantic models, which ensures data validation, serialization, and clear API documentation.
4.  **Containerization (`Dockerfile`):** The application is designed to run inside a Docker container. The `Dockerfile` is optimized for small image size and security, using a multi-stage build to handle dependencies.

## Project Structure

```
.
├── apis/               # Directory for API endpoint routers
│   ├── cart.py         # Cart management endpoints
│   ├── payments.py     # Payment processing endpoint
│   └── products.py     # Product browsing and searching endpoints
├── requests/           # Example .http files for API interaction
│   ├── cart.http
│   ├── payments.http
│   └── products.http
├── .venv/              # Virtual environment managed by uv
├── data.py             # In-memory data generation
├── models.py           # Pydantic data models
├── main.py             # Main FastAPI application entrypoint
├── Dockerfile          # For building the production Docker image
├── Makefile            # For simplifying common development tasks
└── requirements.txt    # Project dependencies
```

## How to Run

You can run the application either locally on your machine or within a Docker container.

### Local Development

This is the recommended approach for active development, as it provides hot-reloading.

1.  **Install dependencies:** This will create a virtual environment and install all required packages.
    ```bash
    make install
    ```

2.  **Run the server:**
    ```bash
    make run
    ```
    The API will be available at `http://localhost:8000`, and the interactive OpenAPI documentation can be accessed at `http://localhost:8000/docs`.

### Running with Docker

This is the recommended approach for a production-like deployment.

1.  **Build the Docker image:**
    ```bash
    make docker-build
    ```

2.  **Run the container:**
    ```bash
    make docker-run
    ```
    The API will be available at `http://localhost:8000`.

3.  **Stop the container:**
    ```bash
    make docker-stop
    ```
