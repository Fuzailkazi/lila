#!/usr/bin/env python3
"""Export processed telemetry into match-centric JSON for the frontend."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

import pandas as pd

from parse_telemetry import find_telemetry_files, load_all, load_map_config


def to_timestamp_ms(value: Any) -> int | None:
    """Convert telemetry timestamp to Unix milliseconds."""
    if pd.isna(value):
        return None

    ts = pd.to_datetime(value, errors="coerce", utc=True)
    if pd.isna(ts):
        return None
    return int(ts.value // 1_000_000)


def classify_event_type(event_name: Any) -> str:
    """Normalize raw event strings to frontend categories."""
    text = str(event_name).strip()
    lower = text.lower()

    if lower == "position":
        return "Position"
    if "loot" in lower:
        return "Loot"
    if "zone" in lower or "storm" in lower:
        return "Zone"
    if "kill" in lower:
        return "Kill"
    return "Other"


def as_float(value: Any) -> float | None:
    """Convert number-like values to float, returning None for invalid values."""
    if pd.isna(value):
        return None
    number = float(value)
    if math.isnan(number):
        return None
    return number


def validate_required_columns(df: pd.DataFrame) -> None:
    required = {"match_id", "map_id", "user_id", "is_bot", "event", "ts", "pixel_x", "pixel_y"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")


def build_matches_payload(df: pd.DataFrame) -> tuple[list[dict[str, Any]], int, int]:
    """Build serialized match payload and aggregate counters."""
    validate_required_columns(df)

    matches: list[dict[str, Any]] = []
    total_players = 0
    total_events = 0

    for match_id, match_group in df.groupby("match_id", dropna=True):
        map_id = str(match_group["map_id"].dropna().iloc[0]) if match_group["map_id"].notna().any() else ""

        players: list[dict[str, Any]] = []
        for user_id, player_group in match_group.groupby("user_id", dropna=True):
            player_sorted = player_group.sort_values("ts")
            position_rows = player_sorted[player_sorted["event"].astype(str) == "Position"]

            path: list[list[float | int]] = []
            for row in position_rows.itertuples(index=False):
                px = as_float(getattr(row, "pixel_x"))
                py = as_float(getattr(row, "pixel_y"))
                ts = to_timestamp_ms(getattr(row, "ts"))
                if px is None or py is None or ts is None:
                    continue
                path.append([px, py, ts])

            is_bot_value = bool(player_group["is_bot"].iloc[0])
            players.append(
                {
                    "user_id": str(user_id),
                    "is_bot": is_bot_value,
                    "path": path,
                }
            )

        players.sort(key=lambda p: p["user_id"])
        total_players += len(players)

        events: list[dict[str, Any]] = []
        for row in match_group.sort_values("ts").itertuples(index=False):
            px = as_float(getattr(row, "pixel_x"))
            py = as_float(getattr(row, "pixel_y"))
            ts = to_timestamp_ms(getattr(row, "ts"))
            if px is None or py is None or ts is None:
                continue
            events.append(
                {
                    "type": classify_event_type(getattr(row, "event")),
                    "pixel_x": px,
                    "pixel_y": py,
                    "timestamp": ts,
                }
            )

        total_events += len(events)
        matches.append(
            {
                "match_id": str(match_id),
                "map_id": map_id,
                "players": players,
                "events": events,
            }
        )

    matches.sort(key=lambda m: m["match_id"])
    return matches, total_players, total_events


def main() -> int:
    parser = argparse.ArgumentParser(description="Export telemetry as frontend-ready match JSON.")
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--map-config", type=Path, default=Path("scripts/map_config.json"))
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("frontend/public/data/matches.json"),
    )
    args = parser.parse_args()

    files = find_telemetry_files(args.data_dir)
    if not files:
        print(f"No telemetry files found under: {args.data_dir}", file=sys.stderr)
        return 1

    config = load_map_config(args.map_config)
    telemetry_df = load_all(files, map_config=config)
    if telemetry_df.empty:
        print("No telemetry rows loaded.", file=sys.stderr)
        return 1

    matches, total_players, total_events = build_matches_payload(telemetry_df)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump(matches, f, indent=2)
        f.write("\n")

    print(f"Matches exported: {len(matches)}")
    print(f"Players exported: {total_players}")
    print(f"Events exported: {total_events}")
    print(f"Output file: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
