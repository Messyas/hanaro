"""Fail when application imports cross forbidden architecture boundaries."""

from __future__ import annotations

import ast
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
APP_ROOT = SOURCE_ROOT / "app"
LAYER_NAMES = {"controller", "services", "repository", "models", "support", "utils"}


def module_name(path: Path) -> str:
    parts = list(path.relative_to(SOURCE_ROOT).with_suffix("").parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(["src", *parts])


def resolve_from(module: str, node: ast.ImportFrom) -> str:
    if node.level == 0:
        return node.module or ""

    package = module if module.endswith(".__init__") else module.rpartition(".")[0]
    parts = package.split(".")
    if node.level > 1:
        parts = parts[: -(node.level - 1)]
    if node.module:
        parts.extend(node.module.split("."))
    return ".".join(parts)


def imports_in(tree: ast.Module, module: str) -> list[tuple[str, int]]:
    imports: list[tuple[str, int]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            imports.append((resolve_from(module, node), node.lineno))
        elif isinstance(node, ast.Import):
            imports.extend((alias.name, node.lineno) for alias in node.names)
    return imports


def forbidden_imports(source_layer: str, imported_module: str) -> bool:
    imported_layer = imported_module.removeprefix("src.app.").split(".", 1)[0]
    forbidden = {
        "controller": {"repository"},
        "services": {"controller"},
        "repository": {"controller", "services", "support"},
        "models": {"controller", "services", "repository", "support"},
        "utils": {"controller", "services", "repository", "support"},
    }
    return imported_module.startswith("src.app.") and imported_layer in forbidden.get(source_layer, set())


def main() -> int:
    errors: list[str] = []
    for layer in sorted(LAYER_NAMES):
        if not (APP_ROOT / layer).is_dir():
            errors.append(f"Missing application layer: src/app/{layer}")

    for path in sorted(SOURCE_ROOT.rglob("*.py")):
        module = module_name(path)
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as error:
            errors.append(f"{path}:{error.lineno}: syntax error: {error.msg}")
            continue

        if module.startswith("src.app."):
            source_layer = module.removeprefix("src.app.").split(".", 1)[0]
        else:
            source_layer = ""

        for imported, line in imports_in(tree, module):
            if imported == "src.modules" or imported.startswith("src.modules."):
                errors.append(f"{path}:{line}: legacy import {imported}")
            elif imported == "src.interfaces" or imported.startswith("src.interfaces."):
                errors.append(f"{path}:{line}: legacy import {imported}")
            elif forbidden_imports(source_layer, imported):
                errors.append(f"{path}:{line}: {source_layer} must not depend on {imported}")

    if errors:
        print("Backend architecture violations:")
        print("\n".join(f"- {error}" for error in errors))
        return 1

    print("Backend architecture boundaries: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
