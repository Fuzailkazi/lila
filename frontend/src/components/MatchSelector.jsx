function MatchSelector({ matches, selectedMatchIndex, onChangeMatch }) {
  if (matches.length === 0) return null;

  return (
    <div className="match-picker">
      <label htmlFor="match-select">Select Match</label>
      <select
        id="match-select"
        value={selectedMatchIndex}
        onChange={(e) => onChangeMatch(Number(e.target.value))}
      >
        {matches.map((match, i) => (
          <option key={match.match_id} value={i}>
            {match.match_id} ({match.map_id})
          </option>
        ))}
      </select>
    </div>
  );
}

export default MatchSelector;
