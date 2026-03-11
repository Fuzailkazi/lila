import { useEffect, useMemo, useState } from "react";
import "./App.css";
import HeaderPanel from "./components/HeaderPanel";
import MapView from "./components/MapView";
import MatchSelector from "./components/MatchSelector";
import ToolbarControls from "./components/ToolbarControls";
import { MINIMAP_SOURCE_BY_MAP_ID } from "./constants";
import {
  generateKillHeatmap,
  generateMovementHeatmap,
  kmeans,
} from "./utils/telemetry";

function App() {
  const [matches, setMatches] = useState([]);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

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

  const maxFrames = useMemo(
    () =>
      match?.players?.reduce(
        (max, player) => Math.max(max, player.path?.length || 0),
        0
      ) || 0,
    [match]
  );

  const visibleEventCount = useMemo(() => {
    if (!match || maxFrames <= 0) return 0;
    return Math.floor((frame / maxFrames) * match.events.length);
  }, [match, maxFrames, frame]);

  const analytics = useMemo(() => {
    if (!match) {
      return {
        movementHeatmap: null,
        killHeatmap: null,
        killClusters: [],
        maxMovementIntensity: 0,
        maxKillIntensity: 0,
      };
    }

    const movementHeatmap = generateMovementHeatmap(match);
    const killHeatmap = generateKillHeatmap(match);
    const killPoints = match.events
      .filter((event) => event.type?.toLowerCase().includes("kill"))
      .map((event) => ({ x: event.pixel_x, y: event.pixel_y }));

    return {
      movementHeatmap,
      killHeatmap,
      killClusters: kmeans(killPoints, 3),
      maxMovementIntensity: Math.max(...movementHeatmap.flat(), 0),
      maxKillIntensity: Math.max(...killHeatmap.flat(), 0),
    };
  }, [match]);

  useEffect(() => {
    if (!playing || maxFrames <= 0) return;

    const interval = setInterval(() => {
      setFrame((currentFrame) => {
        if (currentFrame + 1 >= maxFrames) return currentFrame;
        return currentFrame + 1;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [playing, maxFrames]);

  const handleMatchChange = (matchIndex) => {
    setSelectedMatchIndex(matchIndex);
    setFrame(0);
    setPlaying(false);
  };

  return (
    <main className="app-shell">
      <section className="app-panel">
        <HeaderPanel matchesCount={matches.length} mapId={match?.map_id} />

        <MatchSelector
          matches={matches}
          selectedMatchIndex={selectedMatchIndex}
          onChangeMatch={handleMatchChange}
        />

        <ToolbarControls
          match={match}
          playing={playing}
          onTogglePlay={() => setPlaying((current) => !current)}
          onToggleHeatmap={() => setShowHeatmap((current) => !current)}
          onToggleKillHeatmap={() => setShowKillHeatmap((current) => !current)}
          onToggleClusters={() => setShowClusters((current) => !current)}
          frame={frame}
          maxFrames={maxFrames}
          onFrameChange={setFrame}
        />
      </section>

      <MapView
        match={match}
        minimapSrc={minimapSrc}
        frame={frame}
        visibleEventCount={visibleEventCount}
        showHeatmap={showHeatmap}
        showKillHeatmap={showKillHeatmap}
        showClusters={showClusters}
        movementHeatmap={analytics.movementHeatmap}
        killHeatmap={analytics.killHeatmap}
        maxMovementIntensity={analytics.maxMovementIntensity}
        maxKillIntensity={analytics.maxKillIntensity}
        killClusters={analytics.killClusters}
      />
    </main>
  );
}

export default App;
