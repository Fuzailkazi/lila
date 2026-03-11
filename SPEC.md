Goal:
Build a Player Journey Visualization Tool for gameplay telemetry.

Dataset:
Files have extension .nakama-0 but are Apache Parquet files.

Each file represents one player's events in one match.

Multiple files share the same match_id.

To reconstruct a match we must combine files by match_id.

Columns include:
user_id
match_id
map_id
ts
event
x
y
z

Events include:
Position
BotPosition
Kill
Killed
BotKill
BotKilled
Loot
KilledByStorm

Coordinate conversion:

u = (x - origin_x) / scale
v = (z - origin_z) / scale

pixel_x = u * 1024
pixel_y = (1 - v) * 1024

Required features:

- player path visualization
- kill markers
- loot markers
- storm death markers
- match timeline playback
- heatmaps of activity

Deliverables:

- hosted web tool
- GitHub repo
- 1 page architecture document