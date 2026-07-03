'use client';

interface Lapse {
  cardId: number;
  question: string;
  lastRating: string;
  reviewedAt: string;
  tags: string[];
}

interface LapsesTileProps {
  lapses: Lapse[];
  onDrillNow: () => void;
}

export default function LapsesTile({ lapses, onDrillNow }: LapsesTileProps) {
  if (lapses.length === 0) {
    return (
      <div className="lapses-tile lapses-empty">
        <strong>No recent lapses</strong>
        <p className="muted">Nothing rated `again` or `hard` in the last 7 days.</p>
      </div>
    );
  }
  return (
    <div className="lapses-tile">
      <div className="lapses-header">
        <strong>{lapses.length} lapse{lapses.length === 1 ? '' : 's'} in the last 7 days</strong>
        <button className="btn btn-primary btn-sm" onClick={onDrillNow}>Drill now</button>
      </div>
      <ul className="lapses-list">
        {lapses.slice(0, 5).map((l) => (
          <li key={l.cardId}>
            <span className={`lapse-rating rating-${l.lastRating}`}>{l.lastRating}</span>
            <span className="lapse-question">{l.question}</span>
          </li>
        ))}
      </ul>
      {lapses.length > 5 && <p className="muted">…and {lapses.length - 5} more</p>}
    </div>
  );
}
