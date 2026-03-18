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
    seat_map: list[dict[str, Any]],
) -> tuple[int, list[dict[str, Any]]]:
    """Convert any chain's seat_map into CineRadar Unified Grid format.

    Args:
        seat_map: Raw seat_map array from TIX API response.

    Returns:
        (total_seats, unified_layout) where unified_layout is:
        [{"row_name": "A", "seats": [{"id": "A1", "type": "seat"}, ...]}, ...]

    Key principle: We care about EXISTENCE, not availability.
    Every node with a valid seat_id is a seat, even if currently sold/blocked.
    """
    if not seat_map:
        return 0, []

    # Detect format: nested (XXI/CGV) vs flat (Cinépolis/CGV B2B)
    if "seat_rows" in seat_map[0]:
        return _parse_nested(seat_map)
    else:
        return _parse_flat(seat_map)


def _parse_nested(seat_map: list[dict[str, Any]]) -> tuple[int, list[dict[str, Any]]]:
    """Parse XXI/CGV nested format.

    Input shape:
    [{"seat_code": "A", "seat_rows": [{"seat_row": "A1", "status": 1}, ...]}, ...]
    """
    total_seats = 0
    layout: list[dict[str, Any]] = []

    for item in seat_map:
        row_name = item.get("seat_code", item.get("row_name", ""))
        seats: list[dict[str, str]] = []

        for seat in item.get("seat_rows", []):
            seat_id = seat.get("seat_row", "")
            if not seat_id:
                # No seat_id → likely a gap/spacer in the API response
                seats.append({"id": "", "type": "aisle"})
                continue

            seats.append({"id": seat_id, "type": "seat"})
            total_seats += 1

        if seats:
            layout.append({"row_name": row_name, "seats": seats})

    return total_seats, layout


def _parse_flat(seat_map: list[dict[str, Any]]) -> tuple[int, list[dict[str, Any]]]:
    """Parse Cinépolis/CGV B2B flat format.

    Input shape:
    [{"row_name": "A", "seat_no": "A1", "seat_yn": "1", "seat_status": 0}, ...]
    """
    total_seats = 0
    # Preserve insertion order with dict
    rows: dict[str, list[dict[str, str]]] = {}

    for item in seat_map:
        row_name = item.get("row_name", "ALL")
        seat_id = item.get("seat_no", "")
        seat_yn = item.get("seat_yn", "1")

        if row_name not in rows:
            rows[row_name] = []

        if seat_yn == "0" or not seat_id:
            # Aisle / void
            rows[row_name].append({"id": "", "type": "aisle"})
        else:
            # Physical seat exists (regardless of seat_status)
            rows[row_name].append({"id": seat_id, "type": "seat"})
            total_seats += 1

    layout = [{"row_name": rn, "seats": ss} for rn, ss in rows.items()]
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
