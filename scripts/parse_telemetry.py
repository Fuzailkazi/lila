#!/usr/bin/env python3
"""Parse Nakama telemetry parquet files into a unified pandas DataFrame.

Step 1.1 responsibilities:
- Recursively discover `*.nakama-0` files under `data/`
- Read each file with pyarrow.parquet
- Convert to pandas DataFrame
- Decode `event` values from bytes to UTF-8 strings
- Add `is_bot` classification from `user_id`
- Backfill `match_id` / `user_id` from filename when needed
- Concatenate all rows and print a load summary
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable

import pandas as pd
import pyarrow.parquet as pq

FILENAME_PATTERN = re.compile(r"^(?P<user_id>[^_]+)_(?P<match_id>.+)\.nakama-0$")
UUID_PATTERN = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
PIXEL_SIZE = 1024.0


def find_telemetry_files(root_dir: Path) -> list[Path]:
    """Return sorted telemetry paths under `root_dir`."""
    return sorted(root_dir.rglob("*.nakama-0"))


def parse_ids_from_filename(path: Path) -> tuple[str | None, str | None]:
    """Extract `(user_id, match_id)` from expected telemetry filename format."""
    match = FILENAME_PATTERN.match(path.name)
    if not match:
        return None, None
    return match.group("user_id"), match.group("match_id")


def decode_event_value(value: object) -> str | object:
    """Decode bytes-like event values to UTF-8."""
    if isinstance(value, (bytes, bytearray)):
        return bytes(value).decode("utf-8", errors="replace")
    return value


def is_bot_user_id(user_id: object) -> bool:
    """Classify user IDs: numeric = bot, UUID = human."""
    if user_id is None or (isinstance(user_id, float) and pd.isna(user_id)):
        return False

    text = str(user_id).strip()
    if text.isdigit():
        return True
    if UUID_PATTERN.fullmatch(text):
        return False

    # Unknown format: keep conservative default as non-bot.
    return False


def fill_missing_id_column(
    df: pd.DataFrame, column: str, fallback_value: str | None
) -> pd.DataFrame:
    """Fill null/empty values in `column` with `fallback_value`."""
    if fallback_value is None:
        return df

    if column not in df.columns:
        df[column] = fallback_value
        return df

    missing_mask = df[column].isna() | (df[column].astype(str).str.strip() == "")
    if missing_mask.any():
        df.loc[missing_mask, column] = fallback_value
    return df


def load_map_config(path: Path) -> dict[str, dict[str, float]]:
    """Load map coordinate calibration config from JSON."""
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    config: dict[str, dict[str, float]] = {}
    for map_id, values in raw.items():
        config[str(map_id)] = {
            "origin_x": float(values["origin_x"]),
            "origin_z": float(values["origin_z"]),
            "scale": float(values["scale"]),
        }
    return config


def add_pixel_coordinates(
    df: pd.DataFrame, map_config: dict[str, dict[str, float]] | None
) -> pd.DataFrame:
    """Attach pixel-space coordinates from world-space x/z columns."""
    df = df.copy()
    df["pixel_x"] = pd.NA
    df["pixel_y"] = pd.NA

    if not map_config:
        return df

    required_columns = {"map_id", "x", "z"}
    if not required_columns.issubset(df.columns):
        return df

    for map_id, cfg in map_config.items():
        mask = df["map_id"] == map_id
        if not mask.any():
            continue

        origin_x = cfg["origin_x"]
        origin_z = cfg["origin_z"]
        scale = cfg["scale"]
        if scale <= 0:
            continue

        u = (df.loc[mask, "x"] - origin_x) / scale
        v = (df.loc[mask, "z"] - origin_z) / scale

        pixel_x = (u * PIXEL_SIZE).clip(lower=0.0, upper=PIXEL_SIZE)
        pixel_y = ((1.0 - v) * PIXEL_SIZE).clip(lower=0.0, upper=PIXEL_SIZE)

        df.loc[mask, "pixel_x"] = pixel_x
        df.loc[mask, "pixel_y"] = pixel_y

    return df


def load_file(path: Path) -> pd.DataFrame:
    """Load a single parquet telemetry file into a normalized DataFrame."""
    table = pq.read_table(path)
    df = table.to_pandas()

    file_user_id, file_match_id = parse_ids_from_filename(path)
    df = fill_missing_id_column(df, "user_id", file_user_id)
    df = fill_missing_id_column(df, "match_id", file_match_id)

    if "event" in df.columns:
        df["event"] = df["event"].map(decode_event_value)

    if "user_id" not in df.columns:
        df["user_id"] = file_user_id

    df["is_bot"] = df["user_id"].map(is_bot_user_id)
    return df


def load_all(
    files: Iterable[Path], map_config: dict[str, dict[str, float]] | None = None
) -> pd.DataFrame:
    """Load and concatenate telemetry rows from all files."""
    frames: list[pd.DataFrame] = [load_file(path) for path in files]
    if not frames:
        return pd.DataFrame()
    combined = pd.concat(frames, ignore_index=True)
    return add_pixel_coordinates(combined, map_config)


def print_summary(file_count: int, df: pd.DataFrame) -> None:
    """Print required ingestion summary metrics."""
    rows = len(df)
    unique_matches = df["match_id"].nunique(dropna=True) if "match_id" in df.columns else 0
    unique_players = df["user_id"].nunique(dropna=True) if "user_id" in df.columns else 0

    print("Telemetry load summary")
    print(f"- files: {file_count}")
    print(f"- rows: {rows}")
    print(f"- unique matches: {unique_matches}")
    print(f"- unique players: {unique_players}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse Nakama telemetry files.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data"),
        help="Root directory to scan recursively for *.nakama-0 files.",
    )
    parser.add_argument(
        "--map-config",
        type=Path,
        default=Path("scripts/map_config.json"),
        help="Path to map calibration config JSON.",
    )
    args = parser.parse_args()

    files = find_telemetry_files(args.data_dir)
    if not files:
        print(f"No telemetry files found under: {args.data_dir}", file=sys.stderr)
        return 1

    map_config = load_map_config(args.map_config)
    combined_df = load_all(files, map_config=map_config)
    print_summary(len(files), combined_df)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
