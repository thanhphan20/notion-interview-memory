'use client';

interface HeatmapTileProps {
  tile: {
    tag: string;
    retentionRate: number | null;
    ratingAverageTrend: number | null;
    cardCount: number;
    measuredCardCount: number;
    status: 'green' | 'yellow' | 'red' | 'grey';
    isColdTag: boolean;
  };
  onClick: (tag: string) => void;
}

function trendLabel(trend: number | null): { glyph: string; className: string; a11y: string } {
  if (trend === null) return { glyph: '', className: '', a11y: '' };
  if (trend > 0.05) return { glyph: '↑', className: 'heatmap-trend-up', a11y: 'improving' };
  if (trend < -0.05) return { glyph: '↓', className: 'heatmap-trend-down', a11y: 'declining' };
  return { glyph: '→', className: 'heatmap-trend-flat', a11y: 'stable' };
}

export default function HeatmapTile({ tile, onClick }: HeatmapTileProps) {
  const { tag, retentionRate, ratingAverageTrend, cardCount, measuredCardCount, status, isColdTag } = tile;
  const pct = retentionRate === null ? null : Math.round(retentionRate * 100);
  const trend = trendLabel(ratingAverageTrend);

  return (
    <button
      className={`heatmap-tile heatmap-${status}`}
      onClick={() => onClick(tag)}
      aria-label={`${tag}: ${isColdTag ? 'not measured' : `${pct}% retention`}, ${cardCount} card${cardCount === 1 ? '' : 's'}`}
    >
      <div className="heatmap-tile-header">
        <span className="heatmap-tag" title={tag}>{tag}</span>
        <span className={`heatmap-status-dot heatmap-dot-${status}`} aria-hidden="true" />
      </div>

      <div className="heatmap-tile-body">
        {isColdTag ? (
          <div className="heatmap-cold">
            <span className="heatmap-cold-label">New</span>
            <span className="heatmap-cold-hint">Run a diagnostic to measure</span>
          </div>
        ) : (
          <div className="heatmap-metric">
            <span className="heatmap-pct">{pct}</span>
            <span className="heatmap-pct-unit">%</span>
            {trend.glyph && (
              <span className={`heatmap-trend ${trend.className}`} aria-label={trend.a11y}>
                {trend.glyph}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="heatmap-tile-footer">
        <span>{cardCount} card{cardCount === 1 ? '' : 's'}</span>
        {!isColdTag && (
          <>
            <span className="heatmap-dot-sep">·</span>
            <span>{measuredCardCount} measured</span>
          </>
        )}
      </div>
    </button>
  );
}
