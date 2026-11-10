# Makefile for managing Arkanoid

# Variables
VENV_DIR = .venv
IMAGE_NAME = arkanoid
CONTAINER_NAME = arkanoid-app

.PHONY: help install run format lint test requirements openapi docker-build docker-run docker-stop clean pre-commit

help:
	@echo "Makefile for managing Arkanoid"
	@echo ""
	@echo "Usage:"
	@echo "  make help           Show this help message"
	@echo "  make install        Create a virtual environment and install dependencies"
	@echo "  make run            Run the FastAPI application locally"
	@echo "  make docker-build   Build the Docker image"
	@echo "  make docker-run     Run the application inside a Docker container"
	@echo "  make docker-stop    Stop and remove the Docker container"
	@echo "  make format         Format code with ruff"
	@echo "  make lint           Lint code with ruff"
	@echo "  make test           Run API regression tests"
	@echo "  make requirements   Export locked runtime dependencies for Docker"
	@echo "  make openapi        Export the documented OpenAPI schema to openapi.json"
	@echo "  make pre-commit     Run pre-commit hooks against all files"
	@echo "  make clean          Remove the virtual environment and __pycache__ directories"


install:
	@echo "Syncing the Python environment and locked dependencies with uv..."
	@uv sync --locked
	@echo "Installing pre-commit hooks..."
	@uv run --locked pre-commit install

run:
	@echo "Starting FastAPI server with uvicorn..."
	@uv run --locked uvicorn main:app --reload

format:
	@echo "Formatting code with ruff..."
	@uv run --locked ruff format .
	@uv run --locked ruff check --fix .

lint:
	@echo "Linting code with ruff..."
	@uv run --locked ruff check .

test:
	@uv run --locked python -m unittest discover -s tests -v

requirements:
	@uv export --locked --no-dev --no-hashes --no-emit-project --output-file requirements.txt

openapi:
	@uv run --locked python export_openapi.py

pre-commit:
	@echo "Running pre-commit hooks on all files..."
	@uv run --locked pre-commit run --all-files

docker-build:
	@echo "Building Docker image: $(IMAGE_NAME)..."
	@docker build -t $(IMAGE_NAME) .

docker-run:
	@echo "Running Docker container: $(CONTAINER_NAME)..."
	@docker run -d --name $(CONTAINER_NAME) -p 8000:8000 $(IMAGE_NAME)
	@echo "Container is running. Access the API at http://localhost:8000"

docker-stop:
	@echo "Stopping and removing Docker container: $(CONTAINER_NAME)..."
	@docker stop $(CONTAINER_NAME) || true
	@docker rm $(CONTAINER_NAME) || true

clean:
	@echo "Cleaning up project..."
	@rm -rf $(VENV_DIR)
	@find . -type d -name "__pycache__" -exec rm -r {} +
	@echo "Cleanup complete."
