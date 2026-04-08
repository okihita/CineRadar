"""Studio Layout Parser — Chain-Agnostic Seat Map Normalizer.

Converts TIX API seat maps (XXI/CGV nested, Cinépolis flat) into
CineRadar Unified Grid format for master studio baselines.

Critical difference from SeatScraper.calculate_occupancy():
  - calculate_occupancy() tracks availability (free vs sold).
  - This module tracks physical existence (seat vs aisle).
  - Status codes (1, 5, 6) are all treated as valid physical seats.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def parse_to_master_layout(
    seat_map: Any,
) -> tuple[int, list[dict[str, Any]]]:
    """Convert any chain's seat_map into CineRadar Unified Grid format.

    Args:
        seat_map: Raw seat_map array or full TIX API response object.

    Returns:
        (total_seats, unified_layout) where unified_layout is:
        [{"row_name": "A", "seats": [{"id": "A1", "type": "seat"}, ...]}, ...]
    """
    if not seat_map:
        return 0, []

    max_cols = None

    # Handle full response wrapper
    if isinstance(seat_map, dict):
        if "data" in seat_map and isinstance(seat_map["data"], dict):
            # Extract width hint if available (Vista pattern)
            max_cols = seat_map["data"].get("max_horizontal_seat")
            seat_map = seat_map["data"].get("seat_map", [])
        elif "data" in seat_map and isinstance(seat_map["data"], list):
            seat_map = seat_map["data"]

    if not isinstance(seat_map, list) or not seat_map:
        return 0, []

    # Detect format: nested (XXI/CGV) vs flat (Cinépolis/CGV B2B)
    if "seat_rows" in seat_map[0]:
        return _parse_nested(seat_map)
    else:
        return _parse_flat_modulo(seat_map, max_cols=max_cols)


def _parse_nested(seat_map: list[dict[str, Any]]) -> tuple[int, list[dict[str, Any]]]:
    """Parse XXI/CGV nested format."""
    total_seats = 0
    layout: list[dict[str, Any]] = []

    for item in seat_map:
        row_name = item.get("seat_code", item.get("row_name", ""))
        seats: list[dict[str, str]] = []

        for seat in item.get("seat_rows", []):
            seat_id = seat.get("seat_row", "")
            if not seat_id:
                seats.append({"id": "", "type": "aisle"})
                continue

            seats.append({"id": seat_id, "type": "seat"})
            total_seats += 1

        if seats:
            layout.append({"row_name": row_name, "seats": seats})

    return total_seats, layout


def _parse_flat(seat_map: list[dict[str, Any]]) -> tuple[int, list[dict[str, Any]]]:
    """Parse Cinépolis/CGV B2B/Flix flat format using Modulo-Aware Chunking.

    This follows Rule 4.1 of the Technical Specification:
    1. Slice 1D stream into chunks of size 'max_horizontal_seat'.
    2. Inherit row_name from the first non-empty label in the chunk.
    """
    # We need max_horizontal_seat to wrap.
    # Since this function only receives the list, we look at the first item's metadata
    # or assume a default.
    # NOTE: Better to have the caller pass the width, but for now we look for patterns.
    # In most TIX responses, there are exactly max_horizontal_seat items per physical line.

    # Heuristic: Count items until row_name changes or repeats
    # But better: The caller should provide max_cols.
    # For now, let's detect the 'natural' width if not provided.

    # Actually, let's re-read the technical spec. Most flat responses
    # are wrapped in a 'data' object that HAS 'max_horizontal_seat'.
    # I will modify the parent function to pass this down.
    return _parse_flat_modulo(seat_map, max_cols=None)
def _parse_flat_modulo(seat_map: list[dict[str, Any]], max_cols: int | None = None) -> tuple[int, list[dict[str, Any]]]:
    total_seats = 0
    layout: list[dict[str, Any]] = []

    if not seat_map:
        return 0, []

    # If max_cols is not provided, try to infer it from the response or assume 10
    if max_cols is None:
        # Cinépolis/CGV usually have it in the same list or parent.
        # For this pilot, if we don't have it, we use a sensible default or
        # look for the first repeated row_name + seat_no combo.
        max_cols = 10

    # Chunk the flat list into physical rows
    for i in range(0, len(seat_map), max_cols):
        chunk = seat_map[i : i + max_cols]
        if not chunk:
            continue

        # Inherit row name from first non-empty label in this chunk
        row_name = ""
        for item in chunk:
            if item.get("row_name"):
                row_name = item["row_name"]
                break

        seats: list[dict[str, str]] = []
        for item in chunk:
            seat_no = item.get("seat_no", "")
            seat_yn = str(item.get("seat_yn", "1"))

            if seat_yn == "0" or not seat_no:
                seats.append({"id": "", "type": "aisle"})
            else:
                # Use provided row_name if it exists for this specific seat,
                # otherwise use the inherited one.
                s_row = item.get("row_name", row_name)
                seat_id = f"{s_row}{seat_no}" if s_row else seat_no
                seats.append({"id": seat_id, "type": "seat"})
                total_seats += 1

        layout.append({"row_name": row_name, "seats": seats})

    return total_seats, layout


def merge_layouts_logical_or(
    layouts: list[list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """Merge multiple layouts via Logical OR on seat existence.

    If a coordinate appears as a seat in ANY layout, it is a seat
    in the merged result. This "learns" the maximum physical capacity
    even when individual showtime scrapes have sold/blocked seats
    that appear as gaps.

    Args:
        layouts: List of unified layouts (each from parse_to_master_layout).

    Returns:
        Merged unified layout with maximum known seat coverage.
    """
    if not layouts:
        return []
    if len(layouts) == 1:
        return layouts[0]

    # Build a master map: row_name → position → seat_entry
    # We use position index within the row to align seats across layouts.
    master: dict[str, dict[int, dict[str, str]]] = {}

    for layout in layouts:
        for row in layout:
            row_name = row.get("row_name", "")
            seats = row.get("seats", [])

            if row_name not in master:
                master[row_name] = {}

            for pos, seat in enumerate(seats):
                if seat.get("type") == "seat":
                    # OR: if any layout says this position is a seat, it's a seat
                    master[row_name][pos] = seat
                elif pos not in master[row_name]:
                    # Only set to aisle if no layout has marked it as a seat
                    master[row_name][pos] = seat

    # Reconstruct as ordered list
    merged: list[dict[str, Any]] = []
    # Use first layout's row order as canonical
    seen_rows: set[str] = set()
    row_order: list[str] = []
    for layout in layouts:
        for row in layout:
            rn = row.get("row_name", "")
            if rn not in seen_rows:
                row_order.append(rn)
                seen_rows.add(rn)

    for row_name in row_order:
        if row_name not in master:
            continue
        positions = master[row_name]
        max_pos = max(positions.keys()) if positions else -1
        seats = [positions.get(i, {"id": "", "type": "aisle"}) for i in range(max_pos + 1)]
        merged.append({"row_name": row_name, "seats": seats})

    return merged
