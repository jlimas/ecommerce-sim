import unicodedata
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from api_documentation import PRODUCT_EXAMPLE, PRODUCT_NOT_FOUND, ProductId, success_response
from data import PRODUCTS
from models import Product

router = APIRouter()


def normalize_text(value: str) -> str:
    """Normaliza mayúsculas y acentos para las búsquedas del catálogo."""
    return "".join(c for c in unicodedata.normalize("NFD", value.casefold()) if not unicodedata.combining(c))


@router.get(
    "/products",
    response_model=List[Product],
    summary="Consultar productos",
    operation_id="listProducts",
    responses=success_response(
        "Catálogo completo o filtrado; [] si ningún producto coincide.",
        coincidencia=[PRODUCT_EXAMPLE],
        sinCoincidencias=[],
    ),
)
async def get_products(
    brand: Optional[str] = Query(
        default=None,
        description="Marca exacta del catálogo. No distingue mayúsculas ni acentos.",
        examples=["Coca-Cola"],
    ),
    presentation: Optional[str] = Query(
        default=None,
        description="Presentación exacta; conserva las unidades y espacios del catálogo.",
        examples=["600 ml"],
    ),
    category: Optional[str] = Query(
        default=None,
        description="Categoría exacta. Obtén los valores disponibles del catálogo sin filtrar.",
        examples=["Bebidas", "Botanas", "Lácteos"],
    ),
) -> list[dict]:
    """Consulta el catálogo con filtros opcionales. Todos los precios están en MXN.

    Sin filtros devuelve todos los productos, sin paginación. Los filtros se combinan con AND
    y comparan valores completos, ignorando mayúsculas y acentos. Por ejemplo:
    `/products?brand=Coca-Cola&presentation=600%20ml`.
    Una lista vacía significa que no hay coincidencias, no un error de conexión.
    Usa `id` como `productId` al agregar al carrito; `price` es el precio de una unidad de esa presentación.
    """
    filters = {"brand": brand, "presentation": presentation, "category": category}
    return [
        product
        for product in PRODUCTS
        if all(
            normalize_text(product["attributes"][key]) == normalize_text(value)
            for key, value in filters.items()
            if value
        )
    ]


@router.get(
    "/products/search",
    response_model=List[Product],
    summary="Buscar productos",
    operation_id="searchProducts",
    responses=success_response(
        "Coincidencias parciales por identificador, nombre o descripción.",
        buscarRefresco=[PRODUCT_EXAMPLE],
        sinCoincidencias=[],
    ),
)
async def search_products(
    q: str = Query(
        ...,
        min_length=3,
        description="Busca por identificador, nombre o descripción (mínimo 3 caracteres). "
        "No distingue mayúsculas ni acentos.",
        openapi_examples={
            "porNombre": {"summary": "Buscar refresco", "value": "Coca-Cola"},
            "sinAcentos": {"summary": "Buscar café sin escribir el acento", "value": "cafe"},
            "porIdentificador": {"summary": "Buscar por identificador", "value": "PRD_1"},
        },
    ),
) -> list[dict]:
    """Busca productos por identificador, nombre o descripción.

    La búsqueda es parcial, sin distinguir mayúsculas ni acentos. `cafe` encuentra `Café`.
    Una consulta como `PRD_1` también puede encontrar `PRD_10`; para un identificador exacto usa `getProduct`.
    Si no hay coincidencias devuelve []; para consultas menores de tres caracteres devuelve 422.
    Para buscar por marca o categoría usa los filtros de `listProducts`.
    """
    query = normalize_text(q)
    return [p for p in PRODUCTS if any(query in normalize_text(p[key]) for key in ("id", "name", "description"))]


@router.get(
    "/products/{product_id}",
    response_model=Product,
    summary="Consultar un producto",
    operation_id="getProduct",
    responses={
        **success_response("Detalles de una presentación vendible.", producto=PRODUCT_EXAMPLE),
        **PRODUCT_NOT_FOUND,
    },
)
async def get_product(product_id: ProductId) -> dict:
    """Consulta los detalles y el precio en MXN de un producto.

    Usa el id exacto devuelto por el catálogo. Esta operación permite resolver las referencias
    productId del carrito para mostrar nombres, presentaciones y precios al cliente.
    Si recibes 404, vuelve a consultar el catálogo; no sustituyas productos sin revisar la elección del cliente.
    """
    product = next((p for p in PRODUCTS if p["id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product
