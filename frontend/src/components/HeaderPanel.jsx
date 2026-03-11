function HeaderPanel({ matchesCount, mapId }) {
  return (
    <header className="app-header">
      <h1>Telemetry Viewer</h1>
      <p>
        {matchesCount} matches loaded
        {mapId ? ` • ${mapId}` : ""}
      </p>
    </header>
  );
}

export default HeaderPanel;
