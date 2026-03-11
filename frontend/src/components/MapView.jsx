import { DISPLAY_SIZE, MAP_SIZE } from "../constants";
import { clampToMap, getEventColor, isBot } from "../utils/telemetry";

function MapView({
  match,
  minimapSrc,
  frame,
  visibleEventCount,
  showHeatmap,
  showKillHeatmap,
  showClusters,
  movementHeatmap,
  killHeatmap,
  maxMovementIntensity,
  maxKillIntensity,
  killClusters,
}) {
  return (
    <section className="map-stage">
      <div
        className="map-container"
        style={{
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE,
        }}
      >
        {match && minimapSrc && <img src={minimapSrc} alt="map" className="map-image" />}

        {showHeatmap &&
          movementHeatmap &&
          movementHeatmap.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              if (!value || maxMovementIntensity === 0) return null;

              const alpha = 0.08 + (value / maxMovementIntensity) * 0.55;
              const rowCount = movementHeatmap.length;
              const colCount = row.length;

              return (
                <div
                  key={`movement-${rowIndex}-${colIndex}`}
                  style={{
                    position: "absolute",
                    left: `${(colIndex / colCount) * 100}%`,
                    top: `${(rowIndex / rowCount) * 100}%`,
                    width: `${100 / colCount}%`,
                    height: `${100 / rowCount}%`,
                    backgroundColor: `rgba(0, 173, 181, ${alpha})`,
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
              );
            })
          )}

        {showKillHeatmap &&
          killHeatmap &&
          killHeatmap.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              if (!value || maxKillIntensity === 0) return null;

              const alpha = 0.12 + (value / maxKillIntensity) * 0.65;
              const rowCount = killHeatmap.length;
              const colCount = row.length;

              return (
                <div
                  key={`kill-${rowIndex}-${colIndex}`}
                  style={{
                    position: "absolute",
                    left: `${(colIndex / colCount) * 100}%`,
                    top: `${(rowIndex / rowCount) * 100}%`,
                    width: `${100 / colCount}%`,
                    height: `${100 / rowCount}%`,
                    backgroundColor: `rgba(255, 61, 61, ${alpha})`,
                    zIndex: 1.5,
                    pointerEvents: "none",
                  }}
                />
              );
            })
          )}

        {showClusters &&
          killClusters.map((cluster, i) => (
            <div
              key={`cluster-${i}`}
              className="cluster-ring"
              style={{
                left: `${(cluster.x / MAP_SIZE) * 100}%`,
                top: `${(cluster.y / MAP_SIZE) * 100}%`,
              }}
            />
          ))}

        {match &&
          match.players.map((player) => {
            if (!player.path || player.path.length < 2) return null;

            const color = isBot(player) ? "red" : "cyan";
            const points = player.path
              .slice(0, frame)
              .map(([x, y]) => `${x},${y}`)
              .join(" ");

            return (
              <svg
                key={`path-${player.user_id}`}
                width="100%"
                height="100%"
                viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
                style={{ position: "absolute", inset: 0, zIndex: 2 }}
              >
                <polyline points={points} fill="none" stroke={color} strokeWidth="3" />
              </svg>
            );
          })}

        {match &&
          match.players.map((player) => {
            const point = player.path?.[frame];
            if (!point) return null;
            const [x, y] = point;

            return (
              <div
                key={`player-${player.user_id}`}
                style={{
                  position: "absolute",
                  left: `${(x / MAP_SIZE) * 100}%`,
                  top: `${(y / MAP_SIZE) * 100}%`,
                  width: 12,
                  height: 12,
                  background: isBot(player) ? "red" : "cyan",
                  borderRadius: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 4,
                }}
              />
            );
          })}

        {match &&
          match.events.slice(0, visibleEventCount).map((event, i) => {
            const [px, py] = clampToMap(event.pixel_x, event.pixel_y);

            return (
              <div
                key={`event-${i}`}
                title={event.type}
                style={{
                  position: "absolute",
                  left: `${(px / MAP_SIZE) * 100}%`,
                  top: `${(py / MAP_SIZE) * 100}%`,
                  width: 10,
                  height: 10,
                  background: getEventColor(event.type),
                  borderRadius: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 3,
                }}
              />
            );
          })}
      </div>
    </section>
  );
}

export default MapView;
