# Agent Guidelines for Arkanoid

## Build, Test & Lint Commands

- **Install dependencies:** `make install` (uses `uv sync --locked` and Python 3.15.2)
- **Run development server:** `make run` (hot-reloading on port 8000; API under `/api`, storefront at `/` when `frontend/dist` exists)
- **Frontend:** `cd frontend && pnpm install && pnpm dev` (port 5173, proxies `/api` to port 8000); `pnpm build` produces `frontend/dist`
- **Format code:** `make format` (runs `ruff format` + `ruff check --fix`)
- **Lint code:** `make lint` (runs `ruff check`)
- **Run pre-commit hooks:** `make pre-commit` (runs all hooks against every file)
- **Build Docker image:** `make docker-build`
- **Run Docker container:** `make docker-run`
- **Clean environment:** `make clean`
- **Run tests:** `make test` (runs `uv run --locked python -m unittest discover -s tests -v`)
- **Manual API examples:** `/requests/*.http` files
- **Export OpenAPI:** `make openapi` after changing routes, models, or schema documentation; tests check the committed file

## Package Management
- Use **`uv`** for all dependency management; `pyproject.toml` and `uv.lock` are the source of truth
- `uv sync --locked` creates/syncs the environment using `.python-version`
- `uv add` / `uv add --dev` to add packages; `uv lock --upgrade` to upgrade compatible versions
- `make requirements` exports locked runtime dependencies for Docker; do not edit `requirements.txt` manually

## Code Style & Conventions

### Imports & Structure
- Organize imports: standard library → third-party → local (separated by blank lines)
- All FastAPI routers defined in `apis/` and included in `main.py` on the `api` app
- `web.py` composes the deployed site: `/api/*` → API (root_path `/api`), legacy root API paths → API, everything else → the built React storefront (`frontend/dist`) with an `index.html` fallback
- Use `APIRouter()` with descriptive tags for endpoint grouping

### Formatting & Naming
- Follow PEP 8: 4-space indentation, `snake_case` for functions/variables, `PascalCase` for classes
- Use async/await for all endpoint handlers (FastAPI convention)
- Descriptive docstrings on all endpoints (first line is summary)

### Types & Models
- **All request/response data** must be Pydantic models in `models.py`
- Use `response_model` parameter on `@router` decorators for automatic validation
- Use `Field(alias="camelCase")` for snake_case → camelCase conversion in API contracts
- Type hints required on all function parameters and returns

### Error Handling
- Raise `HTTPException(status_code=..., detail="...")` for API errors
- Use appropriate status codes: 404 for not found, 400 for validation, 500 for server errors
- Always validate resource existence before operations (raise HTTPException early)

### Data & State
- In-memory data stored in `data.py` (PRODUCTS list, CARTS dictionary)
- Arkanoid is a video game store: consoles, games, accessories, screens and collectibles
- Product source: `catalog/products.csv` (already in Mexican Spanish); category display names and defaults: `catalog/localization.json`
- Preserve source SKUs and numeric MXN prices. `price` is the current (offer) price per piece; `listPrice` and `discountPercent` are informational; `quantity` counts pieces
- No inventory: supply is unlimited, products have no `stock` field and carts/payments never check availability
- See `catalog/README.md` for source inconsistencies and normalization decisions
- Product filtering, synonyms, text search and sorting live in `catalog_query.py`; `listProducts` returns 400 with valid values for unknown filter values instead of a misleading `[]`
- Log every operation with `app_logging.log_event` (operation name + JSON fields); never log card numbers or PINs. The uvicorn access log hides 404s (scanner noise)
- New top-level modules must be added to the `COPY` line in `Dockerfile`
- Product images are local WebP files in `static/products/`, served through each product's `imageUrl`
- `sync_catalog_images.py` downloads source images; `generate_product_images.py` is optional future AI generation
- Never generate images or fetch remote catalog data during startup or requests
- No database—carts are transient; restart clears carts, not the source catalog
- Initialize default state at module import time

### API Design
- Use semantic HTTP methods: GET (retrieve), POST (create/append), PUT (update), DELETE (remove)
- Path parameters for resource IDs, query parameters for filtering/options
- Consistent JSON response format via Pydantic models and `response_model`
