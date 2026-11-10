"""Registro de operaciones de la API y supresión del ruido de escáneres en el access log."""

import json
import logging
import os
import sys

from fastapi import Request
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

logger = logging.getLogger("arkanoid")


def configure_logging() -> None:
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        logger.addHandler(handler)
        logger.propagate = False
    logger.setLevel(os.environ.get("LOG_LEVEL", "INFO").upper())
    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, NotFoundAccessFilter) for f in access_logger.filters):
        access_logger.addFilter(NotFoundAccessFilter())


class NotFoundAccessFilter(logging.Filter):
    """Oculta las respuestas 404 del access log: casi todas son escáneres buscando `.env` y similares.

    Los 404 de negocio (producto o carrito inexistente) siguen registrándose como operaciones.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        return not (isinstance(args, tuple) and len(args) >= 5 and args[4] == 404)


def log_event(operation: str, level: int = logging.INFO, **fields: object) -> None:
    logger.log(level, "%s %s", operation, json.dumps(fields, ensure_ascii=False, default=str))


def _operation(request: Request) -> str:
    route = request.scope.get("route")
    return getattr(route, "operation_id", None) or getattr(route, "path", None) or request.url.path


async def log_http_exception(request: Request, exc: StarletteHTTPException) -> Response:
    if request.scope.get("route") is not None:
        log_event(
            _operation(request),
            logging.WARNING,
            status=exc.status_code,
            detail=exc.detail,
            path=request.url.path,
            query=request.url.query,
        )
    return await http_exception_handler(request, exc)


async def log_validation_error(request: Request, exc: RequestValidationError) -> Response:
    log_event(
        _operation(request),
        logging.WARNING,
        status=422,
        path=request.url.path,
        query=request.url.query,
        errors=[{"loc": e.get("loc"), "type": e.get("type"), "msg": e.get("msg")} for e in exc.errors()],
    )
    return await request_validation_exception_handler(request, exc)
