"""Script to generate an Entity-Relationship Diagram (ERD) from SQLAlchemy models.

Generates a Mermaid ERD markdown document in docs/ERD.md without requiring
external binary dependencies (like Graphviz).
"""

import importlib
import pkgutil
import sys
from pathlib import Path

# Add backend root directory to python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.infrastructure.database.session import Base  # noqa: E402
from src.infrastructure.logging import get_logger  # noqa: E402

logger = get_logger()


def import_models(package_name: str = "src.app.models") -> None:
    """Automatically import all models from a package and its subpackages."""
    package = importlib.import_module(package_name)
    for _, module_name, _ in pkgutil.walk_packages(package.__path__, package.__name__ + "."):
        try:
            importlib.import_module(module_name)
        except ImportError:
            pass


def map_sql_type_to_mermaid(column_type: str) -> str:
    """Map SQL column types to clean readable names for Mermaid."""
    type_str = str(column_type).upper()
    if "VARCHAR" in type_str or "STRING" in type_str or "TEXT" in type_str:
        return "string"
    if "INTEGER" in type_str or "INT" in type_str or "BIGINT" in type_str:
        return "int"
    if "BOOLEAN" in type_str or "BOOL" in type_str:
        return "boolean"
    if "DATETIME" in type_str or "TIMESTAMP" in type_str or "DATE" in type_str:
        return "datetime"
    if "UUID" in type_str:
        return "uuid"
    if "FLOAT" in type_str or "DECIMAL" in type_str or "NUMERIC" in type_str:
        return "float"
    if "JSON" in type_str:
        return "json"
    return type_str.lower().split("(")[0]


def generate_mermaid_erd() -> str:
    """Generate Mermaid.js ER Diagram from registered SQLAlchemy Base metadata."""
    import_models("src.app.models")

    metadata = Base.metadata
    tables = metadata.tables

    lines = [
        "# Database Entity-Relationship Diagram (ERD)",
        "",
        "> Generated automatically from SQLAlchemy models.",
        "",
        "```mermaid",
        "erDiagram",
    ]

    # Collect foreign key relationships
    relationships = []

    for table_name, table in sorted(tables.items()):
        lines.append(f"    {table_name} {{")
        for col in table.columns:
            col_type = map_sql_type_to_mermaid(col.type)
            keys = []
            if col.primary_key:
                keys.append("PK")
            if col.foreign_keys:
                keys.append("FK")

                for fk in col.foreign_keys:
                    target_table = fk.column.table.name
                    rel_str = f"    {target_table} ||--o{{ {table_name} : \"{col.name}\""
                    if rel_str not in relationships:
                        relationships.append(rel_str)

            key_str = f' "{",".join(keys)}"' if keys else ""
            lines.append(f"        {col_type} {col.name}{key_str}")
        lines.append("    }")
        lines.append("")

    if relationships:
        lines.append("    %% Relationships")
        lines.extend(relationships)

    lines.append("```")
    lines.append("")

    return "\n".join(lines)


def main() -> None:
    """Main execution function."""
    logger.info("Generating ERD from SQLAlchemy models...")

    try:
        mermaid_content = generate_mermaid_erd()

        # Target output path: backend/docs/ERD.md or backend/scripts/ERD.md fallback
        backend_dir = Path(__file__).parent.parent
        output_file = backend_dir / "docs" / "ERD.md"

        try:
            output_file.parent.mkdir(parents=True, exist_ok=True)
            output_file.write_text(mermaid_content, encoding="utf-8")
        except PermissionError:
            output_file = Path(__file__).parent / "ERD.md"
            output_file.write_text(mermaid_content, encoding="utf-8")

        logger.info(f"ERD generated successfully at: {output_file.resolve()}")
        print(f"\n✅ ERD successfully generated at: {output_file.resolve()}\n")

    except Exception as e:
        logger.error(f"Error generating ERD: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
