"""Exporta el contrato OpenAPI para importar en herramientas de integración."""

import json
from pathlib import Path

from main import api


def export_openapi() -> None:
    Path(__file__).with_name("openapi.json").write_text(
        json.dumps(api.openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    export_openapi()
