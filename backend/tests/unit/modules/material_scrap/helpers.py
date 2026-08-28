from pathlib import Path

from src.modules.material_scrap.schemas import MaterialScrapPayload


def canonical_fixture() -> MaterialScrapPayload:
    root = Path(__file__).parents[5]
    payload_path = root / "automation" / "fixtures" / "material_scrap_payload_example.json"
    return MaterialScrapPayload.model_validate_json(payload_path.read_text(encoding="utf-8"))
