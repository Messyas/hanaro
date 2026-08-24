"""Normalize Python coverage paths for a repository-root SonarQube scanner."""

import argparse
from pathlib import Path
from xml.etree import ElementTree


parser = argparse.ArgumentParser()
parser.add_argument("input_path", type=Path)
parser.add_argument("output_path", type=Path)
arguments = parser.parse_args()

tree = ElementTree.parse(arguments.input_path)
sources = tree.getroot().find("sources")

if sources is None:
    raise ValueError("Coverage XML does not contain a <sources> element.")

for source in sources.findall("source"):
    normalized_path = (source.text or "").replace("\\", "/").rstrip("/")
    if normalized_path == "src" or normalized_path.endswith("/backend/src"):
        source.text = "backend/src"

arguments.output_path.parent.mkdir(parents=True, exist_ok=True)
tree.write(arguments.output_path, encoding="utf-8", xml_declaration=True)
