# Makefile for managing the ecommerce-sim project

# Variables
PYTHON_VERSION = 3.11
VENV_DIR = .venv
IMAGE_NAME = ecommerce-sim
CONTAINER_NAME = ecommerce-sim-app

.PHONY: help install run format lint docker-build docker-run docker-stop clean pre-commit

help:
	@echo "Makefile for managing the ecommerce-sim project"
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
	@echo "  make pre-commit     Run pre-commit hooks against all files"
	@echo "  make clean          Remove the virtual environment and __pycache__ directories"


install:
	@echo "Creating virtual environment with uv..."
	@uv venv
	@echo "Installing dependencies from requirements.txt..."
	@uv pip install -r requirements.txt
	@echo "Installing pre-commit hooks..."
	@uv run pre-commit install

run:
	@echo "Starting FastAPI server with uvicorn..."
	@uv run uvicorn main:app --reload

format:
	@echo "Formatting code with ruff..."
	@uv run ruff format .
	@uv run ruff check --fix .

lint:
	@echo "Linting code with ruff..."
	@uv run ruff check .

pre-commit:
	@echo "Running pre-commit hooks on all files..."
	@uv run pre-commit run --all-files

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

