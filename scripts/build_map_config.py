#!/usr/bin/env python3
"""Build per-map coordinate calibration config from telemetry data.

For each `map_id`, this script computes:
- x_min, x_max, z_min, z_max
- x_range, z_range
- origin_x = x_min
- origin_z = z_min
- scale = max(x_range, z_range) with 5% padding

Output is written to `scripts/map_config.json` as:
{
  "<map_id>": {
    "origin_x": <float>,
    "origin_z": <float>,
    "scale": <float>
  }
}
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from parse_telemetry import find_telemetry_files, load_all


def validate_columns(df: pd.DataFrame) -> None:
    """Ensure required telemetry columns exist."""
    required = {"map_id", "x", "z"}
    missing = required - set(df.columns)
    if missing:
        missing_text = ", ".join(sorted(missing))
        raise ValueError(f"Missing required columns: {missing_text}")


def compute_map_config(df: pd.DataFrame, padding_ratio: float = 0.05) -> dict[str, dict[str, float]]:
    """Compute map calibration values from x/z telemetry bounds."""
    validate_columns(df)

    config: dict[str, dict[str, float]] = {}

    grouped = df.groupby("map_id", dropna=True)
    for map_id, group in grouped:
        x_min = float(group["x"].min())
        x_max = float(group["x"].max())
        z_min = float(group["z"].min())
        z_max = float(group["z"].max())

        x_range = x_max - x_min
        z_range = z_max - z_min

        scale = max(x_range, z_range)
        scale *= 1.0 + padding_ratio

        config[str(map_id)] = {
            "origin_x": x_min,
            "origin_z": z_min,
            "scale": scale,
        }

    return config


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate per-map coordinate config.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data"),
        help="Root directory to scan recursively for *.nakama-0 files.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("scripts/map_config.json"),
        help="Output JSON path for generated map calibration config.",
    )
    args = parser.parse_args()

    files = find_telemetry_files(args.data_dir)
    if not files:
        print(f"No telemetry files found under: {args.data_dir}", file=sys.stderr)
        return 1

    telemetry_df = load_all(files)
    if telemetry_df.empty:
        print("No telemetry rows loaded.", file=sys.stderr)
        return 1

    config = compute_map_config(telemetry_df, padding_ratio=0.05)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, sort_keys=True)
        f.write("\n")

    print(f"Wrote map config for {len(config)} map(s) to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
