import { MAP_SIZE } from "../constants";

export function clampToMap(x, y) {
  const px = Math.max(0, Math.min(MAP_SIZE, x));
  const py = Math.max(0, Math.min(MAP_SIZE, y));
  return [px, py];
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function generateMovementHeatmap(match, cellSize = 32) {
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
        grid[gy][gx] += 1;
      }
    });
  });

  return grid;
}

export function generateKillHeatmap(match, cellSize = 32) {
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
      grid[gy][gx] += 1;
    }
  });

  return grid;
}

export function kmeans(points, k = 3, iterations = 10) {
  if (points.length === 0) return [];

  const centroids = [];
  for (let i = 0; i < k; i += 1) {
    centroids.push(points[Math.floor(Math.random() * points.length)]);
  }

  for (let iter = 0; iter < iterations; iter += 1) {
    const clusters = Array.from({ length: k }, () => []);

    points.forEach((point) => {
      let best = 0;
      let bestDist = Infinity;

      centroids.forEach((centroid, i) => {
        const d = distance(point, centroid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });

      clusters[best].push(point);
    });

    clusters.forEach((cluster, i) => {
      if (cluster.length === 0) return;
      const avgX = cluster.reduce((sum, point) => sum + point.x, 0) / cluster.length;
      const avgY = cluster.reduce((sum, point) => sum + point.y, 0) / cluster.length;
      centroids[i] = { x: avgX, y: avgY };
    });
  }

  return centroids;
}

export function isBot(player) {
  return (
    player.is_bot === true ||
    player.is_bot === "true" ||
    player.is_bot === 1
  );
}

export function getEventColor(type) {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("kill")) return "red";
  if (t.includes("loot") || t.includes("pickup")) return "yellow";
  if (t.includes("zone")) return "orange";
  if (t.includes("position")) return "#00ffaa";
  return "#66ccff";
}
