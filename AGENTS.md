# Agent Guidelines for ecommerce-sim

## Build, Test & Lint Commands

- **Install dependencies:** `make install` (uses `uv` for package management)
- **Run development server:** `make run` (hot-reloading on port 8000)
- **Build Docker image:** `make docker-build`
- **Run Docker container:** `make docker-run`
- **Clean environment:** `make clean`
- **No automated tests exist yet** — manually verify API behavior via `/requests/*.http` files

## Package Management
- Use **`uv`** for all dependency management (faster than pip, see `requirements.txt`)
- `uv venv` to create virtual environment
- `uv pip install` to add/update packages

## Code Style & Conventions

### Imports & Structure
- Organize imports: standard library → third-party → local (separated by blank lines)
- All FastAPI routers defined in `apis/` and included in `main.py`
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
- No database—all state is transient; restart clears data
- Initialize default state at module import time

### API Design
- Use semantic HTTP methods: GET (retrieve), POST (create/append), PUT (update), DELETE (remove)
- Path parameters for resource IDs, query parameters for filtering/options
- Consistent JSON response format via Pydantic models and `response_model`
