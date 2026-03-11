Project Rules

Telemetry files:
.nakama-0
They are Apache Parquet files.

Each file = one player in one match.

Combine files using match_id.

Bots:
user_id numeric.

Humans:
user_id UUID.

Visualization:
Use 1024x1024 minimap images.

Output format:
JSON grouped by match_id.