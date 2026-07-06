'use client';

import Countdown from './Countdown';
import HeatmapTile from './HeatmapTile';
import LapsesTile from './LapsesTile';

interface DashboardViewProps {
  dashboard: {
    countdown: any;
    heatmap: any[];
    lapses: any[];
    dueQueue: any[];
  } | null;
  onSetInterviewDate: (date: string | null) => void;
  onTagClick: (tag: string) => void;
  onDrillLapses: () => void;
  onStartSprint: () => void;
  onStartDiagnostic: () => void;
}

export default function DashboardView({
  dashboard,
  onSetInterviewDate,
  onTagClick,
  onDrillLapses,
  onStartSprint,
  onStartDiagnostic,
}: DashboardViewProps) {
  if (!dashboard) {
    return (
      <section className="view view-enter">
        <p className="muted">Loading dashboard…</p>
      </section>
    );
  }

  const { countdown, heatmap, lapses, dueQueue } = dashboard;

  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Where you stand, and what to drill next.</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn btn-secondary btn-sm" onClick={onStartDiagnostic}>
            Run diagnostic
          </button>
          <button className="btn btn-primary btn-sm" onClick={onStartSprint}>
            Start sprint
          </button>
        </div>
      </div>

      <Countdown countdown={countdown} onSetDate={onSetInterviewDate} />

      <div className="dashboard-heatmap">
        <div className="dashboard-section-heading">
          <h3>Heatmap</h3>
          <span className="muted">{heatmap.length} tag{heatmap.length === 1 ? '' : 's'}</span>
        </div>
        <p className="muted heatmap-intro">
          How well you remember each topic, based on your Practice reviews. Click a tile to drill that topic.
        </p>
        {heatmap.length === 0 ? (
          <p className="muted">No cards yet. Sync notes and generate cards to see your heatmap.</p>
        ) : (
          <>
            <ul className="heatmap-legend">
              <li><span className="heatmap-status-dot heatmap-dot-green" aria-hidden="true" /> ≥80% — strong recall</li>
              <li><span className="heatmap-status-dot heatmap-dot-yellow" aria-hidden="true" /> 50–79% — shaky</li>
              <li><span className="heatmap-status-dot heatmap-dot-red" aria-hidden="true" /> &lt;50% — weak, needs drilling</li>
              <li><span className="heatmap-status-dot heatmap-dot-grey" aria-hidden="true" /> New — not enough reviews yet</li>
            </ul>
            <div className="heatmap-grid">
              {heatmap.map((tile) => (
                <HeatmapTile key={tile.tag} tile={tile} onClick={onTagClick} />
              ))}
            </div>
          </>
        )}
      </div>

      <LapsesTile lapses={lapses} onDrillNow={onDrillLapses} />

      <div className="dashboard-due">
        <div className="dashboard-section-heading">
          <h3>Due queue</h3>
          <span className="muted">{dueQueue.length} card{dueQueue.length === 1 ? '' : 's'} due</span>
        </div>
        {dueQueue.length === 0 ? (
          <p className="muted">Nothing due right now.</p>
        ) : (
          <ul className="due-list">
            {dueQueue.slice(0, 5).map((c: any) => (
              <li key={c.id}>{c.question}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
