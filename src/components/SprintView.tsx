'use client';

import { useMemo, useState } from 'react';

interface SprintCard {
  id: number;
  question: string;
  expectedAnswer: string;
  tags: string[];
}

interface SprintMCQ {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
}

interface SprintItem {
  kind: 'card' | 'mcq';
  card?: SprintCard;
  mcq?: SprintMCQ;
}

interface SprintSession {
  sprintId: number;
  cards: SprintCard[];
  mcqs: SprintMCQ[];
}

interface SprintResult {
  score: number;
  tagBreakdown: { tag: string; score: number; total: number }[];
}

interface SprintViewProps {
  session: SprintSession | null;
  result: SprintResult | null;
  onStart: () => void;
  onComplete: (payload: { ratings: any[]; mcqAnswers: any[] }) => void;
  onExit: () => void;
}

function interleave(cards: SprintCard[], mcqs: SprintMCQ[]): SprintItem[] {
  const items: SprintItem[] = [];
  const max = Math.max(cards.length, mcqs.length);
  for (let i = 0; i < max; i++) {
    if (i < cards.length) items.push({ kind: 'card', card: cards[i] });
    if (i < mcqs.length) items.push({ kind: 'mcq', mcq: mcqs[i] });
  }
  return items;
}

export default function SprintView({ session, result, onStart, onComplete, onExit }: SprintViewProps) {
  const items = useMemo(() => session ? interleave(session.cards, session.mcqs) : [], [session]);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<number, string>>({});
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});
  const [showKey, setShowKey] = useState(false);

  if (result) {
    return (
      <section className="view view-enter">
        <div className="section-heading">
          <div>
            <h2>Sprint complete</h2>
            <p className="muted">Full FSRS updates applied. Score feeds the Countdown running average.</p>
          </div>
        </div>
        <div className="sprint-result">
          <div className="sprint-score">
            <span className="sprint-score-value">{result.score}</span>
            <span className="sprint-score-total">/20</span>
          </div>
          <div className="sprint-breakdown">
            <h3>By tag</h3>
            <ul>
              {result.tagBreakdown.map((row) => (
                <li key={row.tag}>
                  <span className="sprint-tag">{row.tag}</span>
                  <span className="sprint-tag-score">{row.score}/{row.total}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="sprint-actions">
            <button className="btn btn-primary" onClick={onStart}>Run another sprint</button>
            <button className="btn btn-ghost" onClick={onExit}>Back to dashboard</button>
          </div>
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="view view-enter">
        <div className="section-heading">
          <div>
            <h2>Sprint</h2>
            <p className="muted">20 items · ~50/50 MCQ &amp; open-recall · weighted to red/yellow tags. Full FSRS updates apply.</p>
          </div>
        </div>
        <div className="sprint-start">
          <p>A sprint is a fixed 20-item pressure test. Same shape every time so you can benchmark yourself week-over-week.</p>
          <button className="btn btn-primary" onClick={onStart}>Start sprint</button>
        </div>
      </section>
    );
  }

  const item = items[index];
  const isCard = item?.kind === 'card';
  const currentCard = isCard ? item!.card! : null;
  const currentMCQ = !isCard ? item!.mcq! : null;
  const isLast = index === items.length - 1;

  const rateCard = (rating: string) => {
    if (!currentCard) return;
    setRatings((prev) => ({ ...prev, [currentCard.id]: rating }));
    setShowKey(false);
    if (isLast) {
      submit({ ...ratings, [currentCard.id]: rating }, mcqAnswers);
    } else {
      setIndex((i) => i + 1);
    }
  };

  const answerMCQ = (optionIdx: number) => {
    if (!currentMCQ) return;
    setMcqAnswers((prev) => ({ ...prev, [currentMCQ.id]: optionIdx }));
    if (isLast) {
      submit(ratings, { ...mcqAnswers, [currentMCQ.id]: optionIdx });
    } else {
      setTimeout(() => setIndex((i) => i + 1), 700);
    }
  };

  const submit = (finalRatings: Record<number, string>, finalMCQAnswers: Record<number, number>) => {
    const ratingsPayload = Object.entries(finalRatings).map(([cardId, rating]) => ({
      cardId: Number(cardId),
      rating,
      elapsedSeconds: 0,
    }));
    const mcqPayload = Object.entries(finalMCQAnswers).map(([mcqId, selectedIndex]) => {
      const mcq = session.mcqs.find((m) => m.id === Number(mcqId));
      return {
        mcqId: Number(mcqId),
        selectedIndex,
        correct: mcq ? selectedIndex === mcq.correctIndex : false,
      };
    });
    onComplete({ ratings: ratingsPayload, mcqAnswers: mcqPayload });
  };

  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Sprint · {index + 1} / {items.length}</h2>
          <p className="muted">{isCard ? 'Open recall' : 'Multiple choice'} · Answer, then advance.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>Abandon</button>
      </div>

      <div className="sprint-progress">
        <div className="sprint-progress-bar" style={{ width: `${((index + 1) / items.length) * 100}%` }} />
      </div>

      {currentCard && (
        <div className="sprint-item">
          <p className="sprint-question">{currentCard.question}</p>
          <div className="sprint-controls">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowKey((s) => !s)}>
              {showKey ? 'Hide answer' : 'Show answer'}
            </button>
          </div>
          {showKey && <div className="sprint-answer-key">{currentCard.expectedAnswer}</div>}
          <div className="sprint-ratings">
            {(['again', 'hard', 'good', 'easy'] as const).map((r) => (
              <button key={r} className={`btn btn-rate btn-rate-${r}`} onClick={() => rateCard(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {currentMCQ && (
        <div className="sprint-item">
          <p className="sprint-question">{currentMCQ.question}</p>
          <div className="sprint-mcq-options">
            {currentMCQ.options.map((opt, idx) => {
              const answered = mcqAnswers[currentMCQ.id];
              const isAnswered = answered !== undefined;
              const isSelected = answered === idx;
              const isCorrect = idx === currentMCQ.correctIndex;
              const cls = isAnswered
                ? (isCorrect ? 'correct' : isSelected ? 'wrong' : '')
                : '';
              return (
                <button
                  key={idx}
                  className={`sprint-mcq-option ${cls}`}
                  disabled={isAnswered}
                  onClick={() => answerMCQ(idx)}
                >
                  <span className="sprint-mcq-letter">{String.fromCharCode(65 + idx)}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
