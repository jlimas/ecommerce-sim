"""Filtros, búsqueda y ordenamiento tolerantes del catálogo."""

import re
import unicodedata
from collections import Counter
from collections.abc import Callable, Iterable
from urllib.parse import parse_qsl, urlencode

from fastapi import HTTPException

from app_logging import log_event
from data import PRODUCTS

# Agent runtimes often serialize unset optional parameters as these literals instead of omitting them.
NULLISH_VALUES = frozenset(
    {"", "null", "none", "undefined", "nil", "nan", "*", "all", "any", "todas", "todos", "todo", "cualquiera"}
)
PARAMETER_ALIASES = {
    "min_price": "minPrice",
    "minprice": "minPrice",
    "price_min": "minPrice",
    "max_price": "maxPrice",
    "maxprice": "maxPrice",
    "price_max": "maxPrice",
    "tags": "tag",
    "query": "q",
    "search": "q",
}
PRICE_PARAMETERS = {"minPrice", "maxPrice"}
SORT_OPTIONS = {
    "relevance": "Orden del catálogo; con q, primero las coincidencias de la frase completa.",
    "priceAsc": "Precio vigente (price) de menor a mayor.",
    "priceDesc": "Precio vigente (price) de mayor a menor.",
    "discountDesc": "Mayor descuento (discountPercent) primero.",
    "nameAsc": "Nombre en orden alfabético.",
}
STOPWORDS = frozenset("a al con de del el en la las lo los mi mis o para por que sin su sus un una unas unos y".split())
MIN_QUERY_LENGTH = 3


def normalize(value: str) -> str:
    """Ignora mayúsculas, acentos, puntuación y espacios repetidos."""
    text = "".join(c for c in unicodedata.normalize("NFD", value.casefold()) if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^0-9a-z]+", " ", text).split())


def variants(value: str) -> set[str]:
    """Formas singulares aproximadas para aceptar `consola` o `Consolas`, `control` o `controles`."""
    forms = {value}
    if value.endswith("es") and len(value) > 4:
        forms.add(value[:-2])
    if value.endswith("s") and len(value) > 3:
        forms.add(value[:-1])
    return forms


def ranked_values(values: Iterable[str]) -> list[str]:
    return [value for value, _ in Counter(values).most_common()]


PLATFORMS = ranked_values(p["attributes"]["platform"] for p in PRODUCTS)
BRANDS = ranked_values(p["attributes"]["brand"] for p in PRODUCTS)
CATEGORIES = ranked_values(p["attributes"]["category"] for p in PRODUCTS)
TAGS = ranked_values(tag for p in PRODUCTS for tag in p["tags"])


def _aliases(groups: dict[str, list[str]]) -> dict[str, str]:
    return {normalize(alias): value for value, names in groups.items() for alias in names}


PLATFORM_ALIASES = _aliases(
    {
        "Nintendo Switch 2": ["switch 2", "switch2", "ns2", "nintendo switch2"],
        "Nintendo Switch": ["switch", "switch 1", "nintendo switch 1", "switch oled", "switch lite", "ns"],
        "PlayStation 5": ["ps5", "ps 5", "playstation", "play station 5", "play 5", "sony"],
        "Xbox Series": ["xbox", "xbox series x", "xbox series s", "xbox series x s", "series x", "series s", "xsx"],
        "TV": ["television", "televisor", "pantalla"],
        "PC portátil": ["pc", "laptop", "pc portatil gaming"],
    }
)
BRAND_ALIASES = _aliases({"PlayStation": ["sony", "ps5"], "Xbox": ["microsoft"]})
CATEGORY_ALIASES = _aliases(
    {
        "Videojuegos": ["juego", "juegos", "game", "games", "videojuego"],
        "Consolas": ["console", "consoles"],
        "Accesorios": ["accessory", "accessories"],
        "Pantallas": ["tv", "television", "televisor", "televisores", "monitor"],
        "Coleccionables": ["figura", "figuras", "collectible", "collectibles"],
    }
)
TAG_ALIASES = _aliases(
    {
        "familia": ["familiar", "familiares", "family", "toda la familia", "infantil", "ninos", "kids"],
        "multijugador": ["multiplayer", "varios jugadores", "multijugadores"],
        "mundo-abierto": ["open world"],
        "un-jugador": ["single player", "un solo jugador", "individual"],
        "cooperativo": ["coop", "co op", "cooperative"],
        "clasico": ["retro", "classic"],
        "fiesta": ["party"],
        "carreras": ["racing"],
        "aventura": ["adventure"],
        "accion": ["action"],
        "deportes": ["sports"],
        "futbol": ["soccer", "football"],
        "peleas": ["fighting", "pelea"],
        "preventa": ["preorder", "pre venta", "pre order"],
        "regalo": ["gift"],
        "audifonos": ["headphones", "headset", "audifono"],
        "control": ["controller", "gamepad"],
    }
)

FilterKind = tuple[str, list[str], dict[str, str]]
PLATFORM_FILTER: FilterKind = ("Plataforma", PLATFORMS, PLATFORM_ALIASES)
BRAND_FILTER: FilterKind = ("Marca", BRANDS, BRAND_ALIASES)
CATEGORY_FILTER: FilterKind = ("Categoría", CATEGORIES, CATEGORY_ALIASES)
TAG_FILTER: FilterKind = ("Etiqueta", TAGS, TAG_ALIASES)


def resolve(value: str, kind: FilterKind) -> set[str]:
    """Traduce el valor recibido a valores exactos del catálogo o responde 400 con las opciones válidas."""
    label, choices, aliases = kind
    wanted = normalize(value)
    forms = variants(wanted)
    matches = {choice for choice in choices if forms & variants(normalize(choice))}
    if not matches:
        matches = {aliases[form] for form in forms if form in aliases}
    if not matches and len(wanted) >= MIN_QUERY_LENGTH:
        # A shortened name such as `Switch 2` or `Xbox` is accepted only at word boundaries,
        # so `Switch` resolves to `Nintendo Switch` but never to `Nintendo Switch 2`.
        matches = {
            choice
            for choice in choices
            if normalize(choice).endswith(" " + wanted) or normalize(choice).startswith(wanted + " ")
        }
    if not matches:
        raise HTTPException(
            status_code=400,
            detail=f"{label} no reconocida: {value!r}. Valores válidos: {', '.join(choices)}.",
        )
    return matches


def parse_tags(value: str) -> list[set[str]]:
    return [resolve(tag, TAG_FILTER) for tag in value.split(",") if normalize(tag) not in NULLISH_VALUES]


def _searchable(product: dict) -> list[str]:
    return [normalize(text) for text in (product["id"], product["name"], product["description"], *product["tags"])]


SEARCHABLE = {product["id"]: _searchable(product) for product in PRODUCTS}


def query_score(product: dict, query: str) -> int:
    """2 = frase completa en un campo; 1 = todas las palabras significativas en algún campo; 0 = sin coincidencia."""
    fields = SEARCHABLE[product["id"]]
    if any(query in field for field in fields):
        return 2
    words = [word for word in query.split() if word not in STOPWORDS]
    if not words:
        return 0
    text = " ".join(fields)
    vocabulary = set(text.split())

    def found(word: str) -> bool:
        if len(word) < MIN_QUERY_LENGTH:
            return word in vocabulary
        return any(form in text for form in variants(word))

    return 1 if all(found(word) for word in words) else 0


def validate_query(q: str) -> str:
    query = normalize(q)
    if len(query.replace(" ", "")) < MIN_QUERY_LENGTH:
        raise HTTPException(status_code=400, detail=f"q requiere al menos {MIN_QUERY_LENGTH} letras o dígitos.")
    return query


SORT_KEYS: dict[str, Callable[[dict], object]] = {
    "priceAsc": lambda p: p["price"],
    "priceDesc": lambda p: -p["price"],
    "discountDesc": lambda p: -p["discountPercent"],
    "nameAsc": lambda p: normalize(p["name"]),
}


def _compact(value: str) -> str:
    return normalize(value).replace(" ", "")


SORT_ALIASES = {
    _compact(alias): option
    for option, aliases in {
        "relevance": ["relevance", "relevancia", "default", "recomendado"],
        "priceAsc": [
            "price asc",
            "price",
            "precio",
            "precio asc",
            "menor precio",
            "mas barato",
            "barato",
            "cheap",
            "cheapest",
            "asc",
        ],
        "priceDesc": ["price desc", "precio desc", "mayor precio", "mas caro", "expensive", "desc"],
        "discountDesc": ["discount desc", "discount", "descuento", "mayor descuento", "best discount"],
        "nameAsc": ["name asc", "name", "nombre", "alfabetico", "az"],
    }.items()
    for alias in aliases
}
DESCENDING_SORTS = {"priceAsc": "priceDesc", "nameAsc": "nameAsc", "discountDesc": "discountDesc"}


def resolve_sort(value: str | None) -> str:
    """Acepta camelCase, snake_case, kebab-case y sinónimos: `price_asc`, `precio`, `-price`."""
    if value is None:
        return "relevance"
    option = SORT_ALIASES.get(_compact(value))
    if option and value.strip().startswith("-"):
        option = DESCENDING_SORTS.get(option, option)
    if option:
        return option
    raise HTTPException(
        status_code=400, detail=f"sort no reconocido: {value!r}. Valores válidos: {', '.join(SORT_OPTIONS)}."
    )


def _clean_price(value: str) -> str:
    """Acepta `$1,800`, `1800 MXN` o `1,800.50`: la coma es separador de miles en México."""
    cleaned = re.sub(r"(?i)mxn|pesos|\$|,|\s", "", value)
    return cleaned or value


def clean_query_string(raw: bytes) -> bytes:
    pairs = []
    for key, value in parse_qsl(raw.decode("latin-1"), keep_blank_values=True):
        if normalize(value) in NULLISH_VALUES:
            continue
        key = PARAMETER_ALIASES.get(key, PARAMETER_ALIASES.get(key.casefold(), key))
        pairs.append((key, _clean_price(value) if key in PRICE_PARAMETERS else value))
    return urlencode(pairs).encode("latin-1")


class ProductQueryCleanupMiddleware:
    """Descarta parámetros vacíos o `null` y normaliza alias y precios antes de validar la consulta."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "http" and scope["path"].startswith("/products") and scope.get("query_string"):
            raw = scope["query_string"]
            cleaned = clean_query_string(raw)
            if parse_qsl(cleaned.decode(), keep_blank_values=True) != parse_qsl(
                raw.decode("latin-1"), keep_blank_values=True
            ):
                log_event(
                    "productQueryCleanup", path=scope["path"], raw=raw.decode("latin-1"), cleaned=cleaned.decode()
                )
            scope = {**scope, "query_string": cleaned}
        await self.app(scope, receive, send)
