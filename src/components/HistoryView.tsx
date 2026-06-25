'use client';

import Card from './ui/Card';
import HistorySummary from './HistorySummary';

interface Review {
  id: number;
  rating: string;
  userAnswer: string;
  aiFeedback?: { summary: string };
  reviewedAt: string;
}

interface HistoryViewProps {
  reviews: Review[];
}

export default function HistoryView({ reviews }: HistoryViewProps) {
  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Review History</h2>
          <p className="muted">Recent answers, ratings, and feedback.</p>
        </div>
      </div>

      <HistorySummary reviews={reviews} />

      <div className="stack">
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <Card key={review.id}>
              <div className="actions">
                <span className={`rating-badge ${review.rating}`}>
                  {review.rating}
                </span>
              </div>
              <p className="body-md">{review.userAnswer}</p>
              {review.aiFeedback && (
                <p className="muted">AI: {review.aiFeedback.summary}</p>
              )}
              <p className="label-sm" style={{ color: 'var(--muted)' }}>
                {new Date(review.reviewedAt).toLocaleString()}
              </p>
            </Card>
          ))
        ) : (
          <div className="empty-state">
            <p>No reviews yet. Practice cards to see your history here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
