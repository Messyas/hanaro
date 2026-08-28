"""Contract placeholder for the future GERP UI automation.

The real implementation must obtain the report file and then delegate all
processing to ``automation.material_scrap``. No visual automation is included
in the current delivery.
"""

from automation.material_scrap.source import GerpSource, RunContext

__all__ = ["GerpSource", "RunContext"]
