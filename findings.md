# Findings & Research Notes

## Data Schema

| Column   | Type        | Notes                                                  |
|----------|-------------|--------------------------------------------------------|
| user_id  | string      | UUID = human player, numeric = bot                     |
| match_id | string      | Shared across files; format `uuid.nakama-0`            |
| map_id   | string      | One of: AmbroseValley, GrandRift, Lockdown             |
| x, y, z  | float       | World-space coordinates; y is vertical (elevation)     |
| ts       | timestamp   | Millisecond-precision (epoch-based, 1970-01-21 range)  |
| event    | binary      | Stored as bytes; must call `.decode('utf-8')` to read  |

## File Naming Convention

`{user_id}_{match_id}.nakama-0`

- Each file = one player in one match
- Multiple files with the same `match_id` suffix = same match, different players

## Event Types

| Event        | Description                                |
|--------------|--------------------------------------------|
| Position     | Player movement / position update          |
| BotPosition  | Bot movement (not seen in sample data yet) |
| Kill         | Player killed another human                |
| Killed       | Player was killed by another human         |
| BotKill      | Player killed a bot                        |
| BotKilled    | Player was killed by a bot                 |
| Loot         | Player picked up loot                      |
| KilledByStorm| Player died to storm                       |

## Maps & Coordinate Ranges (from sample data)

| Map            | x range          | z range          | y range         | Minimap file                  |
|----------------|------------------|------------------|-----------------|-------------------------------|
| AmbroseValley  | [-187.75, 193.77]| [-365.15, 335.69]| [100.45, 152.26]| AmbroseValley_Minimap.png     |
| GrandRift      | [-224.31, -3.59] | [-156.38, 164.21]| [8.53, 45.97]   | GrandRift_Minimap.png         |
| Lockdown       | [15.52, 143.40]  | [121.47, 314.32] | [34.01, 43.56]  | Lockdown_Minimap.jpg          |

## Coordinate Conversion (from SPEC)

```
u = (x - origin_x) / scale
v = (z - origin_z) / scale
pixel_x = u * 1024
pixel_y = (1 - v) * 1024
```

> [!IMPORTANT]
> `origin_x`, `origin_z`, and `scale` are **not** present in the data.
> These must be calibrated per map by inspecting known coordinates against the minimap images.
> An initial approach: use the min/max of x and z from all data for each map,
> set `origin_x = x_min`, `origin_z = z_min`, `scale = max(x_max - x_min, z_max - z_min)`.

## Key Constraints

1. **No shared matches in sample data** — each file has a unique `match_id`. Real data will have multiple files per match.
2. **Timestamps** use a peculiar epoch (1970-01-21). Treat them as relative within each match.
3. **Minimap images** are assumed to be 1024×1024 target space (confirmed by AGENT.md).
4. **Event column** is `binary` type in parquet — always decode to string before processing.
5. **Sample size** is small (5 files, 20–144 rows each). Pipeline must scale to larger datasets.
