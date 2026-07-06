'use client';

interface HeatmapTileProps {
  tile: {
    tag: string;
    retentionRate: number | null;
    ratingAverageTrend: number | null;
    cardCount: number;
    measuredCardCount: number;
    totalReviews: number;
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
  const { tag, retentionRate, ratingAverageTrend, cardCount, measuredCardCount, totalReviews, status, isColdTag } = tile;
  const pct = retentionRate === null ? null : Math.round(retentionRate * 100);
  const trend = trendLabel(ratingAverageTrend);
  const hasStarted = totalReviews > 0;

  const tooltip = isColdTag
    ? `${tag}: not enough Practice history yet — ${totalReviews} review${totalReviews === 1 ? '' : 's'} logged so far. A card counts once you've reviewed it 3+ times in Practice. Click to practice this topic now.`
    : `${tag}: ${pct}% retention — how often your last 3 reviews of a measured card came back "good" or "easy". Based on ${measuredCardCount} of ${cardCount} card${cardCount === 1 ? '' : 's'} with enough review history.${trend.a11y ? ` Trend: ${trend.a11y}.` : ''} Click to practice this topic now.`;

  return (
    <button
      className={`heatmap-tile heatmap-${status}`}
      onClick={() => onClick(tag)}
      title={tooltip}
      aria-label={tooltip}
    >
      <div className="heatmap-tile-header">
        <span className="heatmap-tag" title={tag}>{tag}</span>
        <span className={`heatmap-status-dot heatmap-dot-${status}`} aria-hidden="true" />
      </div>

      <div className="heatmap-tile-body">
        {isColdTag ? (
          <div className="heatmap-cold">
            <span className="heatmap-cold-label">{hasStarted ? 'In progress' : 'New'}</span>
            <span className="heatmap-cold-hint">
              {hasStarted
                ? `${totalReviews} review${totalReviews === 1 ? '' : 's'} logged — practice more to measure`
                : 'Practice this topic to get started'}
            </span>
          </div>
        ) : (
          <div className="heatmap-metric">
            <div className="heatmap-metric-value">
              <span className="heatmap-pct">{pct}</span>
              <span className="heatmap-pct-unit">%</span>
              {trend.glyph && (
                <span className={`heatmap-trend ${trend.className}`} aria-hidden="true">
                  {trend.glyph}
                </span>
              )}
            </div>
            <span className="heatmap-metric-label">retention</span>
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
