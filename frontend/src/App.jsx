import { useEffect, useState } from "react";

const MAP_SIZE = 1024;
const DISPLAY_SIZE = 700;

const MINIMAP_SOURCE_BY_MAP_ID = {
  AmbroseValley: "/maps/AmbroseValley_Minimap.png",
  GrandRift: "/maps/GrandRift_Minimap.png",
  Lockdown: "/maps/Lockdown_Minimap.jpg",
};

function clampToMap(x, y) {
  const px = Math.max(0, Math.min(MAP_SIZE, x));
  const py = Math.max(0, Math.min(MAP_SIZE, y));
  return [px, py];
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ---------------- MOVEMENT HEATMAP ---------------- */

function generateMovementHeatmap(match, cellSize = 32) {
  const cols = Math.ceil(MAP_SIZE / cellSize);
  const rows = Math.ceil(MAP_SIZE / cellSize);

  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  match.players.forEach((player) => {
    player.path?.forEach(([x, y]) => {
      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);

      if (grid[gy] && grid[gy][gx] !== undefined) {
        grid[gy][gx]++;
      }
    });
  });

  return grid;
}

/* ---------------- KILL HEATMAP ---------------- */

function generateKillHeatmap(match, cellSize = 32) {
  const cols = Math.ceil(MAP_SIZE / cellSize);
  const rows = Math.ceil(MAP_SIZE / cellSize);

  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  match.events.forEach((event) => {
    if (!event.type?.toLowerCase().includes("kill")) return;

    const gx = Math.floor(event.pixel_x / cellSize);
    const gy = Math.floor(event.pixel_y / cellSize);

    if (grid[gy] && grid[gy][gx] !== undefined) {
      grid[gy][gx]++;
    }
  });

  return grid;
}

/* ---------------- K-MEANS CLUSTERING ---------------- */

function kmeans(points, k = 3, iterations = 10) {
  if (points.length === 0) return [];

  const centroids = [];

  for (let i = 0; i < k; i++) {
    centroids.push(points[Math.floor(Math.random() * points.length)]);
  }

  for (let iter = 0; iter < iterations; iter++) {
    const clusters = Array.from({ length: k }, () => []);

    points.forEach((p) => {
      let best = 0;
      let bestDist = Infinity;

      centroids.forEach((c, i) => {
        const d = distance(p, c);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });

      clusters[best].push(p);
    });

    clusters.forEach((cluster, i) => {
      if (cluster.length === 0) return;

      const avgX =
        cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length;

      const avgY =
        cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length;

      centroids[i] = { x: avgX, y: avgY };
    });
  }

  return centroids;
}

/* ---------------- APP ---------------- */

function App() {
  const [matches, setMatches] = useState([]);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [heatmap, setHeatmap] = useState(null);
  const [killHeatmap, setKillHeatmap] = useState(null);
  const [killClusters, setKillClusters] = useState([]);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showKillHeatmap, setShowKillHeatmap] = useState(false);
  const [showClusters, setShowClusters] = useState(false);

  useEffect(() => {
    fetch("/data/matches.json")
      .then((res) => res.json())
      .then((data) => {
        const matchesData = Array.isArray(data) ? data : data.matches;
        setMatches(matchesData || []);
      });
  }, []);

  const match = matches[selectedMatchIndex];

  const minimapSrc = match?.map_id
    ? MINIMAP_SOURCE_BY_MAP_ID[match.map_id] ?? null
    : null;

  const maxFrames =
    match?.players?.reduce((max, p) => Math.max(max, p.path?.length || 0), 0) ||
    0;

  /* PLAYBACK */

  useEffect(() => {
    if (!playing) return;

    const interval = setInterval(() => {
      setFrame((f) => {
        if (f + 1 >= maxFrames) return f;
        return f + 1;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [playing, maxFrames]);

  /* ANALYTICS */

  useEffect(() => {
    if (!match) return;

    const movement = generateMovementHeatmap(match);
    const kills = generateKillHeatmap(match);

    const killPoints = match.events
      .filter((e) => e.type?.toLowerCase().includes("kill"))
      .map((e) => ({ x: e.pixel_x, y: e.pixel_y }));

    const clusters = kmeans(killPoints, 3);

    setHeatmap(movement);
    setKillHeatmap(kills);
    setKillClusters(clusters);
  }, [match]);

  function isBot(player) {
    return (
      player.is_bot === true ||
      player.is_bot === "true" ||
      player.is_bot === 1
    );
  }

  function getEventColor(type) {
    const t = type?.toLowerCase();

    if (t.includes("kill")) return "red";
    if (t.includes("loot") || t.includes("pickup")) return "yellow";
    if (t.includes("zone")) return "orange";
    if (t.includes("position")) return "#00ffaa";

    return "#66ccff";
  }

  const visibleEventCount = match
    ? Math.floor((frame / maxFrames) * match.events.length)
    : 0;

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>Telemetry Viewer</h1>

      {matches.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <label>Select Match: </label>

          <select
            value={selectedMatchIndex}
            onChange={(e) => {
              setSelectedMatchIndex(Number(e.target.value));
              setFrame(0);
            }}
          >
            {matches.map((m, i) => (
              <option key={m.match_id} value={i}>
                {m.match_id} ({m.map_id})
              </option>
            ))}
          </select>
        </div>
      )}

      {match && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setPlaying(!playing)}>
            {playing ? "Pause" : "Play"}
          </button>

          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            style={{ marginLeft: 10 }}
          >
            Movement Heatmap
          </button>

          <button
            onClick={() => setShowKillHeatmap(!showKillHeatmap)}
            style={{ marginLeft: 10 }}
          >
            Kill Heatmap
          </button>

          <button
            onClick={() => setShowClusters(!showClusters)}
            style={{ marginLeft: 10 }}
          >
            Kill Hotspots
          </button>

          <input
            type="range"
            min="0"
            max={maxFrames}
            value={frame}
            onChange={(e) => setFrame(Number(e.target.value))}
            style={{ width: 400, marginLeft: 20 }}
          />
        </div>
      )}

      <div
        style={{
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE,
          border: "2px solid black",
          position: "relative",
          backgroundColor: "#111",
        }}
      >
        {match && minimapSrc && (
          <img
            src={minimapSrc}
            alt="map"
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              objectFit: "cover",
              zIndex: 0,
            }}
          />
        )}

        {/* Kill Hotspots */}

        {showClusters &&
          killClusters.map((c, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(c.x / MAP_SIZE) * 100}%`,
                top: `${(c.y / MAP_SIZE) * 100}%`,
                width: 60,
                height: 60,
                border: "3px solid red",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 5,
              }}
            />
          ))}

        {/* Player Paths */}

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
                key={player.user_id}
                width="100%"
                height="100%"
                viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
                style={{ position: "absolute", zIndex: 2 }}
              >
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                />
              </svg>
            );
          })}

        {/* Events */}

        {match &&
          match.events.slice(0, visibleEventCount).map((event, i) => {
            const [px, py] = clampToMap(event.pixel_x, event.pixel_y);

            return (
              <div
                key={i}
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
    </div>
  );
}

export default App;