function ToolbarControls({
  match,
  playing,
  onTogglePlay,
  onToggleHeatmap,
  onToggleKillHeatmap,
  onToggleClusters,
  frame,
  maxFrames,
  onFrameChange,
}) {
  if (!match) return null;

  return (
    <div className="toolbar">
      <button onClick={onTogglePlay}>{playing ? "Pause" : "Play"}</button>
      <button onClick={onToggleHeatmap}>Movement Heatmap</button>
      <button onClick={onToggleKillHeatmap}>Kill Heatmap</button>
      <button onClick={onToggleClusters}>Kill Hotspots</button>

      <div className="timeline">
        <input
          type="range"
          min="0"
          max={maxFrames}
          value={frame}
          onChange={(e) => onFrameChange(Number(e.target.value))}
        />
        <span>
          Frame {frame} / {maxFrames}
        </span>
      </div>
    </div>
  );
}

export default ToolbarControls;
