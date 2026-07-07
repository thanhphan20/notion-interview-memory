'use client';

interface Review {
  id: number;
  rating: string;
  reviewedAt: string;
}

interface MCQReview {
  id: number;
  correct: boolean;
  reviewedAt: string;
}

const RATING_SCORE: Record<string, number> = { again: 1, hard: 2, good: 3, easy: 4 };
const RATING_ORDER = ['again', 'hard', 'good', 'easy'] as const;

interface HistorySummaryProps {
  reviews: Review[];
  mcqReviews?: MCQReview[];
}

export default function HistorySummary({ reviews, mcqReviews = [] }: HistorySummaryProps) {
  if (reviews.length === 0 && mcqReviews.length === 0) return null;

  return (
    <>
      {reviews.length > 0 && <CardSummary reviews={reviews} />}
      {mcqReviews.length > 0 && <McqSummary mcqReviews={mcqReviews} />}
    </>
  );
}

function CardSummary({ reviews }: { reviews: Review[] }) {
  const total = reviews.length;
  const scores = reviews.map((r) => RATING_SCORE[r.rating] || 0);
  const avg = scores.reduce((a, b) => a + b, 0) / total;

  const dist = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const r of reviews) {
    if (r.rating in dist) dist[r.rating as keyof typeof dist]++;
  }

  const bestRating = RATING_ORDER.reduce((a, b) => (dist[a] >= dist[b] ? a : b));
  const bestLabel = bestRating.charAt(0).toUpperCase() + bestRating.slice(1);

  const sorted = [...reviews].sort(
    (a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime()
  );

  return (
    <div className="history-summary">
      <div className="history-summary-stats">
        <div className="history-stat">
          <span className="history-stat-value">{total}</span>
          <span className="history-stat-label">Total Reviews</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{avg.toFixed(2)}</span>
          <span className="history-stat-label">Average Score / 4</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{bestLabel}</span>
          <span className="history-stat-label">Most Frequent</span>
        </div>
      </div>

      <div className="history-distribution">
        <h3 className="label-sm" style={{ marginBottom: '0.5rem', color: 'var(--muted)' }}>
          Rating Distribution
        </h3>
        {RATING_ORDER.map((rating) => {
          const count = dist[rating];
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={rating} className="dist-row">
              <span className={`rating-badge ${rating}`}>{rating}</span>
              <div className="dist-bar-track">
                <div
                  className={`dist-bar-fill ${rating}`}
                  style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span className="dist-count">{count}</span>
            </div>
          );
        })}
      </div>

      <div className="history-timeline">
        <h3 className="label-sm" style={{ marginBottom: '0.5rem', color: 'var(--muted)' }}>
          Performance Trend
        </h3>
        <div className="timeline-chart">
          {sorted.map((r, idx) => {
            const score = RATING_SCORE[r.rating] || 0;
            const leftPct = total > 1 ? (idx / (total - 1)) * 100 : 50;
            const bottomPct = ((score - 1) / 3) * 80 + 10;
            return (
              <div
                key={r.id}
                className={`timeline-dot ${r.rating}`}
                style={{ left: `${leftPct}%`, bottom: `${bottomPct}%` }}
                title={`${r.rating} — ${new Date(r.reviewedAt).toLocaleDateString()}`}
              />
            );
          })}
          {sorted.length > 1 && (
            <svg className="timeline-line" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                points={sorted
                  .map((r, idx) => {
                    const score = RATING_SCORE[r.rating] || 0;
                    const x = total > 1 ? (idx / (total - 1)) * 100 : 50;
                    const y = 100 - (((score - 1) / 3) * 80 + 10);
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="var(--muted)"
                strokeWidth="0.3"
                strokeOpacity="0.4"
              />
            </svg>
          )}
          <div className="timeline-labels">
            <span className="label-sm" style={{ color: 'var(--muted)' }}>Easy</span>
            <span className="label-sm" style={{ color: 'var(--muted)' }}>Again</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function McqSummary({ mcqReviews }: { mcqReviews: MCQReview[] }) {
  const total = mcqReviews.length;
  const correctCount = mcqReviews.filter((r) => r.correct).length;
  const incorrectCount = total - correctCount;
  const accuracy = total > 0 ? (correctCount / total) * 100 : 0;
  const bestLabel = correctCount >= incorrectCount ? 'Correct' : 'Incorrect';

  const sorted = [...mcqReviews].sort(
    (a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime()
  );

  return (
    <div className="history-summary">
      <div className="history-summary-stats">
        <div className="history-stat">
          <span className="history-stat-value">{total}</span>
          <span className="history-stat-label">Total MCQs Answered</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{accuracy.toFixed(0)}%</span>
          <span className="history-stat-label">Accuracy</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{bestLabel}</span>
          <span className="history-stat-label">Most Frequent</span>
        </div>
      </div>

      <div className="history-distribution">
        <h3 className="label-sm" style={{ marginBottom: '0.5rem', color: 'var(--muted)' }}>
          Answer Distribution
        </h3>
        {[
          { key: 'good', label: 'correct', count: correctCount },
          { key: 'again', label: 'incorrect', count: incorrectCount },
        ].map(({ key, label, count }) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={key} className="dist-row">
              <span className={`rating-badge ${key}`}>{label}</span>
              <div className="dist-bar-track">
                <div
                  className={`dist-bar-fill ${key}`}
                  style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span className="dist-count">{count}</span>
            </div>
          );
        })}
      </div>

      <div className="history-timeline">
        <h3 className="label-sm" style={{ marginBottom: '0.5rem', color: 'var(--muted)' }}>
          Performance Trend
        </h3>
        <div className="timeline-chart">
          {sorted.map((r, idx) => {
            const leftPct = total > 1 ? (idx / (total - 1)) * 100 : 50;
            const bottomPct = r.correct ? 80 : 10;
            return (
              <div
                key={r.id}
                className={`timeline-dot ${r.correct ? 'good' : 'again'}`}
                style={{ left: `${leftPct}%`, bottom: `${bottomPct}%` }}
                title={`${r.correct ? 'Correct' : 'Incorrect'} — ${new Date(r.reviewedAt).toLocaleDateString()}`}
              />
            );
          })}
          {sorted.length > 1 && (
            <svg className="timeline-line" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                points={sorted
                  .map((r, idx) => {
                    const x = total > 1 ? (idx / (total - 1)) * 100 : 50;
                    const y = 100 - (r.correct ? 80 : 10);
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="var(--muted)"
                strokeWidth="0.3"
                strokeOpacity="0.4"
              />
            </svg>
          )}
          <div className="timeline-labels">
            <span className="label-sm" style={{ color: 'var(--muted)' }}>Correct</span>
            <span className="label-sm" style={{ color: 'var(--muted)' }}>Incorrect</span>
          </div>
        </div>
      </div>
    </div>
  );
}
