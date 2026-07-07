'use client';

import { useMemo, useState } from 'react';
import Card from './ui/Card';
import HistorySummary from './HistorySummary';
import { IconCheck, IconX } from './ui/Icons';

interface Review {
  id: number;
  rating: string;
  userAnswer: string;
  aiFeedback?: { summary: string };
  reviewedAt: string;
  tags?: string[];
}

interface MCQReview {
  id: number;
  mcqId: number;
  question: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number;
  correct: boolean;
  reviewedAt: string;
  tags?: string[];
}

interface HistoryViewProps {
  reviews: Review[];
  mcqReviews?: MCQReview[];
}

type ReviewType = 'all' | 'card' | 'mcq';

export default function HistoryView({ reviews, mcqReviews = [] }: HistoryViewProps) {
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ReviewType>('all');

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of reviews) {
      for (const t of (r.tags || [])) set.add(t);
    }
    for (const m of mcqReviews) {
      for (const t of (m.tags || [])) set.add(t);
    }
    return Array.from(set).sort();
  }, [reviews, mcqReviews]);

  const filtered = useMemo(() => {
    let entries: { type: 'card' | 'mcq'; reviewedAt: string; data: any }[] = [
      ...reviews.map((r) => ({ type: 'card' as const, reviewedAt: r.reviewedAt, data: r })),
      ...mcqReviews.map((r) => ({ type: 'mcq' as const, reviewedAt: r.reviewedAt, data: r })),
    ];
    if (filterType !== 'all') {
      entries = entries.filter((e) => e.type === filterType);
    }
    if (filterTag) {
      entries = entries.filter((e) => {
        const tags = e.type === 'card' ? (e.data as Review).tags : (e.data as MCQReview).tags;
        return tags && tags.includes(filterTag);
      });
    }
    entries.sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
    return entries;
  }, [reviews, mcqReviews, filterType, filterTag]);

  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Review History</h2>
          <p className="muted">Recent answers, ratings, and feedback.</p>
        </div>
      </div>

      <HistorySummary reviews={reviews} mcqReviews={mcqReviews} />

      <div className="tags" style={{ marginBottom: '0.75rem', minHeight: '1.5rem', alignItems: 'center' }}>
        <button className={`tag-filter ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>
          All
        </button>
        <button className={`tag-filter ${filterType === 'card' ? 'active' : ''}`} onClick={() => setFilterType('card')}>
          Open Recall
        </button>
        <button className={`tag-filter ${filterType === 'mcq' ? 'active' : ''}`} onClick={() => setFilterType('mcq')}>
          Multiple Choice
        </button>
      </div>
      <div className="tags" style={{ marginBottom: '1rem', minHeight: '1.5rem' }}>
        {allTags.length > 0 && !filterTag && allTags.map((tag) => (
          <button key={tag} className="tag-filter" onClick={() => setFilterTag(tag)}>{tag}</button>
        ))}
        {filterTag && (
          <button className="tag-filter active" onClick={() => setFilterTag(null)}>
            {filterTag} <IconX />
          </button>
        )}
      </div>

      <div className="stack">
        {filtered.length > 0 ? (
          filtered.map((entry) => {
            if (entry.type === 'mcq') {
              const m = entry.data as MCQReview;
              return (
                <Card key={`mcq-${m.id}`}>
                  <div className="actions">
                    <span className={`rating-badge ${m.correct ? 'good' : 'again'}`}>
                      {m.correct ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <p className="body-md" style={{ fontWeight: 600 }}>{m.question}</p>
                  {m.options.map((opt: string, idx: number) => {
                    let cls = '';
                    if (idx === m.correctIndex) cls = 'mcq-opt-history-correct';
                    else if (idx === m.selectedIndex) cls = 'mcq-opt-history-wrong';
                    return (
                      <p key={idx} className={`mcq-opt-history ${cls}`}>
                        {idx === m.correctIndex ? <IconCheck /> : idx === m.selectedIndex ? <IconX /> : <span className="mcq-letter-history">{String.fromCharCode(65 + idx)}</span>}
                        {' '}{opt}
                      </p>
                    );
                  })}
                  <p className="label-sm" style={{ color: 'var(--muted)' }}>
                    {new Date(m.reviewedAt).toLocaleString()}
                  </p>
                </Card>
              );
            }
            const review = entry.data as Review;
            return (
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
            );
          })
        ) : (
          <div className="empty-state">
            <p>No reviews yet. Practice cards to see your history here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
