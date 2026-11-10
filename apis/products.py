from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from api_documentation import (
    PRODUCT_EXAMPLE,
    PRODUCT_FILTER_ERRORS,
    PRODUCT_NOT_FOUND,
    ProductId,
    product_not_found,
    success_response,
)
from app_logging import log_event
from catalog_query import (
    BRAND_FILTER,
    BRANDS,
    CATEGORIES,
    CATEGORY_FILTER,
    PLATFORM_FILTER,
    PLATFORMS,
    SORT_KEYS,
    SORT_OPTIONS,
    TAGS,
    normalize,
    parse_tags,
    query_score,
    resolve,
    resolve_sort,
    validate_query,
)
from data import PRODUCTS
from models import Product

router = APIRouter()


def _values(values: list[str]) -> str:
    return ", ".join(values)


def filter_products(
    brand: str | None = None,
    platform: str | None = None,
    category: str | None = None,
    tag: str | None = None,
    q: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    sort: str | None = None,
    limit: int | None = None,
) -> tuple[list[dict], dict]:
    """Devuelve los productos que cumplen todos los filtros y los valores del catálogo a los que se resolvieron."""
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(
            status_code=400, detail=f"minPrice ({min_price}) no puede ser mayor que maxPrice ({max_price})."
        )
    attribute_filters = {
        key: resolve(value, kind)
        for key, value, kind in (
            ("brand", brand, BRAND_FILTER),
            ("platform", platform, PLATFORM_FILTER),
            ("category", category, CATEGORY_FILTER),
        )
        if value
    }
    tag_filters = parse_tags(tag) if tag else []
    query = validate_query(q) if q else None
    order = resolve_sort(sort)

    scored = []
    for product in PRODUCTS:
        if any(product["attributes"][key] not in allowed for key, allowed in attribute_filters.items()):
            continue
        if any(not allowed.intersection(product["tags"]) for allowed in tag_filters):
            continue
        if min_price is not None and product["price"] < min_price:
            continue
        if max_price is not None and product["price"] > max_price:
            continue
        score = query_score(product, query) if query else 0
        if query and not score:
            continue
        scored.append((score, product))

    if order == "relevance":
        scored.sort(key=lambda item: -item[0])
        products = [product for _, product in scored]
    else:
        products = sorted((product for _, product in scored), key=SORT_KEYS[order])
    if limit is not None:
        products = products[:limit]

    resolved = {key: sorted(values) for key, values in attribute_filters.items()}
    if tag_filters:
        resolved["tag"] = [sorted(values) for values in tag_filters]
    if query:
        resolved["q"] = query
    resolved["sort"] = order
    return products, resolved


FAMILY_GAMES_EXAMPLE, _ = filter_products(
    platform="Nintendo Switch 2", category="Videojuegos", tag="familia", max_price=1800, sort="priceAsc"
)


@router.get(
    "/products",
    response_model=List[Product],
    summary="Consultar y filtrar productos",
    operation_id="listProducts",
    responses={
        **success_response(
            "Productos que cumplen todos los filtros a la vez. [] significa que los valores son válidos "
            "pero ninguna combinación coincide; relaja un filtro. Sin parámetros devuelve el catálogo completo.",
            juegosFamiliaresSwitch2HastaMil800=FAMILY_GAMES_EXAMPLE,
            coincidencia=[PRODUCT_EXAMPLE],
            sinCoincidencias=[],
        ),
        **PRODUCT_FILTER_ERRORS,
    },
)
async def get_products(
    platform: Optional[str] = Query(
        default=None,
        description="Plataforma con la que es compatible el producto. Ignora mayúsculas, acentos y guiones, "
        "y acepta nombres cortos y sinónimos: `Switch 2`, `switch2` o `NS2` → Nintendo Switch 2; "
        "`Switch` → Nintendo Switch (no incluye Switch 2); `PS5` → PlayStation 5; `Xbox` o `Series X` → "
        f"Xbox Series. Valores del catálogo: {_values(PLATFORMS)}. "
        "Un valor que no corresponde a ninguna plataforma devuelve 400 con la lista de valores válidos.",
        examples=["Nintendo Switch 2", "Switch 2", "PS5", "Xbox"],
    ),
    category: Optional[str] = Query(
        default=None,
        description="Tipo de producto. Acepta singular o plural y sinónimos (`juegos` → Videojuegos, "
        f"`tv` → Pantallas). Valores del catálogo: {_values(CATEGORIES)}. "
        "Un valor desconocido devuelve 400 con la lista de valores válidos.",
        examples=["Videojuegos", "Consolas", "Accesorios"],
    ),
    brand: Optional[str] = Query(
        default=None,
        description="Marca del catálogo. En muchos videojuegos y accesorios es la marca de la consola, "
        "no la del estudio: Cyberpunk 2077 para Switch 2 tiene marca Nintendo. `Sony` → PlayStation, "
        f"`Microsoft` → Xbox. Valores del catálogo: {_values(BRANDS)}. "
        "Un valor desconocido devuelve 400 con la lista de valores válidos.",
        examples=["Nintendo", "PlayStation", "Xbox"],
    ),
    tag: Optional[str] = Query(
        default=None,
        description="Una o más etiquetas de género, público o uso, separadas por comas. El producto debe "
        "tener **todas** (AND). Ignora mayúsculas, acentos, guiones y plurales y acepta sinónimos comunes: "
        "`familiar`, `infantil` o `niños` → familia; `multiplayer` → multijugador; `mundo abierto` → "
        f"mundo-abierto; `retro` → clasico. Etiquetas del catálogo: {_values(TAGS)}. "
        "Una etiqueta desconocida devuelve 400 con la lista de etiquetas válidas.",
        examples=["familia", "multijugador", "familia,multijugador", "mundo abierto"],
    ),
    q: Optional[str] = Query(
        default=None,
        description="Texto libre en id, nombre, descripción y etiquetas, sin distinguir mayúsculas ni acentos; "
        "mínimo 3 letras o dígitos (si no, 400). Primero busca la frase completa y, si no aparece, "
        "los productos con todas las palabras significativas. Se combina con los demás filtros.",
        examples=["mario", "pokemon", "star fox"],
    ),
    min_price: Optional[float] = Query(
        default=None,
        alias="minPrice",
        ge=0,
        description="Precio vigente mínimo (`price`, ya con descuento), inclusivo, en pesos mexicanos (MXN), "
        "no centavos. También acepta `min_price`, `$1,000` o `1000 MXN`.",
        examples=[500],
    ),
    max_price: Optional[float] = Query(
        default=None,
        alias="maxPrice",
        ge=0,
        description="Precio vigente máximo (`price`, ya con descuento), inclusivo, en pesos mexicanos (MXN), "
        'no centavos. Úsalo para presupuestos: "hasta $1,800 por juego" es `maxPrice=1800`. '
        "También acepta `max_price`, `$1,800` o `1800 MXN`. Debe ser mayor o igual que minPrice.",
        examples=[1800],
    ),
    sort: Optional[str] = Query(
        default=None,
        description="Orden del resultado. "
        + " ".join(f"`{key}`: {value}" for key, value in SORT_OPTIONS.items())
        + " También acepta snake_case, kebab-case y sinónimos: `price_asc`, `precio` o `-price` (descendente). "
        "Un valor desconocido devuelve 400.",
        examples=["priceAsc"],
        json_schema_extra={"enum": list(SORT_OPTIONS)},
    ),
    limit: Optional[int] = Query(
        default=None,
        ge=1,
        le=100,
        description="Máximo de productos devueltos, aplicado después de filtrar y ordenar. "
        "Útil para respuestas cortas, por ejemplo los 5 más baratos con `sort=priceAsc&limit=5`. "
        "Sin limit devuelve todas las coincidencias; no hay paginación.",
        examples=[5],
    ),
) -> list[dict]:
    """Consulta el catálogo con filtros combinables. Todos los precios están en pesos mexicanos (MXN).

    Expresa la petición completa del cliente en una sola llamada. Todos los parámetros son opcionales
    y se combinan con AND. Los parámetros ausentes, vacíos o con `null` se ignoran. Ejemplos:

    - Juegos familiares para Switch 2 de hasta $1,800:
      `/products?platform=Switch 2&category=Videojuegos&tag=familia&maxPrice=1800`
    - Los 5 accesorios más baratos para PS5: `/products?platform=PS5&category=Accesorios&sort=priceAsc&limit=5`
    - Juegos de Mario para Switch 2: `/products?platform=Switch 2&q=mario`
    - Catálogo completo: `/products`

    Interpreta el resultado así:

    - **200 con productos:** usa el `id` de cada uno como `productId` en addToCart; `price` es el precio
      vigente por pieza, con el descuento ya aplicado.
    - **200 con `[]`:** los filtros son válidos pero ninguno de los productos cumple todos a la vez.
      Relaja un filtro (sube maxPrice, quita tag o q) y vuelve a consultar. No digas que el catálogo está vacío.
    - **400:** un valor no existe en el catálogo; `detail` enumera los valores válidos. Corrígelo y reintenta.
    """
    products, resolved = filter_products(brand, platform, category, tag, q, min_price, max_price, sort, limit)
    log_event(
        "listProducts",
        params={
            key: value
            for key, value in {
                "brand": brand,
                "platform": platform,
                "category": category,
                "tag": tag,
                "q": q,
                "minPrice": min_price,
                "maxPrice": max_price,
                "sort": sort,
                "limit": limit,
            }.items()
            if value is not None
        },
        resolved=resolved,
        results=len(products),
        ids=[p["id"] for p in products[:10]],
    )
    return products


@router.get(
    "/products/search",
    response_model=List[Product],
    summary="Buscar productos por texto",
    operation_id="searchProducts",
    responses=success_response(
        "Coincidencias por identificador, nombre, descripción o etiqueta, con las de frase completa primero.",
        buscarJuego=[PRODUCT_EXAMPLE],
        sinCoincidencias=[],
    ),
)
async def search_products(
    q: str = Query(
        ...,
        min_length=3,
        description="Busca por identificador, nombre, descripción o etiqueta (mínimo 3 caracteres). "
        "No distingue mayúsculas ni acentos. Primero la frase completa; si no aparece, los productos "
        "con todas las palabras significativas.",
        openapi_examples={
            "porNombre": {"summary": "Buscar Star Fox", "value": "star fox"},
            "sinAcentos": {"summary": "Buscar Pokémon sin escribir el acento", "value": "pokemon"},
            "porEtiqueta": {"summary": "Buscar juegos para varios jugadores", "value": "multijugador"},
            "porIdentificador": {"summary": "Buscar por SKU", "value": "45467911"},
        },
    ),
) -> list[dict]:
    """Busca productos solo por texto. Para combinar texto con plataforma, precio o etiquetas usa listProducts.

    Equivale a `listProducts?q=...` sin otros filtros. La búsqueda es parcial y no distingue mayúsculas
    ni acentos: `pokemon` encuentra `Pokémon`. Si la frase completa no aparece, devuelve los productos que
    contienen todas sus palabras significativas, en cualquier orden. Las etiquetas (`tags`) describen
    género, público y uso: `multijugador`, `nostalgia`, `mundo-abierto`.
    Una consulta como `4467` encuentra varios SKU; para un identificador exacto usa `getProduct`.
    Si no hay coincidencias devuelve []; para consultas menores de tres caracteres devuelve 422.
    No busca por marca, plataforma o categoría como campos: usa los filtros de `listProducts`.
    """
    query = normalize(q)
    scored = [(score, p) for p in PRODUCTS if (score := query_score(p, query))]
    products = [p for _, p in sorted(scored, key=lambda item: -item[0])]
    log_event("searchProducts", q=q, results=len(products), ids=[p["id"] for p in products[:10]])
    return products


@router.get(
    "/products/{product_id}",
    response_model=Product,
    summary="Consultar un producto",
    operation_id="getProduct",
    responses={
        **success_response("Detalles de un producto del catálogo.", producto=PRODUCT_EXAMPLE),
        **PRODUCT_NOT_FOUND,
    },
)
async def get_product(product_id: ProductId) -> dict:
    """Consulta los detalles y el precio en MXN de un producto.

    Usa el id exacto devuelto por el catálogo. Esta operación permite resolver las referencias
    productId del carrito para mostrar nombres, plataformas y precios al cliente.
    Si recibes 404, vuelve a consultar el catálogo; no sustituyas productos sin revisar la elección del cliente.
    """
    product = next((p for p in PRODUCTS if p["id"] == product_id), None)
    if not product:
        raise product_not_found(product_id)
    log_event("getProduct", productId=product_id)
    return product
