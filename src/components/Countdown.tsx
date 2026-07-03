'use client';

interface CountdownProps {
  countdown: {
    interviewDate: string | null;
    daysUntil: number | null;
    sprintScoreAverage: number | null;
    sprintCount: number;
    heatmapGreenPercent: number | null;
    status: 'active' | 'elapsed' | 'unset';
  };
  onSetDate: (date: string | null) => void;
}

export default function Countdown({ countdown, onSetDate }: CountdownProps) {
  const { status, daysUntil, sprintScoreAverage, heatmapGreenPercent, interviewDate } = countdown;

  if (status === 'unset') {
    return (
      <div className="countdown countdown-unset">
        <div className="countdown-prompt">
          <strong>Set an interview date</strong>
          <p className="muted">Anchor your practice around a real deadline.</p>
        </div>
        <input
          type="date"
          onChange={(e) => e.target.value && onSetDate(e.target.value)}
          className="countdown-date-input"
        />
      </div>
    );
  }

  if (status === 'elapsed') {
    return (
      <div className="countdown countdown-elapsed">
        <div>
          <strong>Interview date has passed</strong>
          <p className="muted">Set a new date, or clear to pause.</p>
        </div>
        <div className="countdown-actions">
          <input
            type="date"
            onChange={(e) => e.target.value && onSetDate(e.target.value)}
            className="countdown-date-input"
          />
          <button onClick={() => onSetDate(null)} className="btn btn-ghost">Pause</button>
        </div>
      </div>
    );
  }

  const green = heatmapGreenPercent === null ? '—' : `${Math.round(heatmapGreenPercent * 100)}%`;
  const sprint = sprintScoreAverage === null ? '—' : `${sprintScoreAverage.toFixed(1)}/20`;

  return (
    <div className="countdown">
      <div className="countdown-days">
        <span className="countdown-number">{daysUntil}</span>
        <span className="countdown-unit">days to interview</span>
        <span className="countdown-date muted">{interviewDate}</span>
      </div>
      <div className="countdown-stats">
        <div className="countdown-stat">
          <span className="countdown-stat-value">{sprint}</span>
          <span className="countdown-stat-label">Sprint avg</span>
        </div>
        <div className="countdown-stat">
          <span className="countdown-stat-value">{green}</span>
          <span className="countdown-stat-label">Heatmap green</span>
        </div>
        <button onClick={() => onSetDate(null)} className="btn btn-ghost btn-sm">Clear</button>
      </div>
    </div>
  );
}
