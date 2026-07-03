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

export default function HeatmapTile({ tile, onClick }: HeatmapTileProps) {
  const { tag, retentionRate, ratingAverageTrend, cardCount, measuredCardCount, status, isColdTag } = tile;
  const pct = retentionRate === null ? '—' : `${Math.round(retentionRate * 100)}%`;
  const trendGlyph = ratingAverageTrend === null ? '' : ratingAverageTrend > 0.05 ? ' ↑' : ratingAverageTrend < -0.05 ? ' ↓' : '';

  return (
    <button className={`heatmap-tile heatmap-${status}`} onClick={() => onClick(tag)}>
      <div className="heatmap-tag">{tag}</div>
      <div className="heatmap-metric">
        {isColdTag ? 'not measured' : (
          <>
            <span className="heatmap-pct">{pct}</span>
            <span className="heatmap-trend">{trendGlyph}</span>
          </>
        )}
      </div>
      <div className="heatmap-count muted">
        {measuredCardCount}/{cardCount} cards
      </div>
    </button>
  );
}
