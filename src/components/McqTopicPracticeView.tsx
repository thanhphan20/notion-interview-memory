'use client';

import { useMemo, useState } from 'react';

interface MCQ {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
}

interface PracticeSession {
  tag: string;
  mcqs: MCQ[];
}

interface PracticeResult {
  tag: string;
  correct: number;
  total: number;
}

interface McqTopicPracticeViewProps {
  allMcqs: MCQ[];
  session: PracticeSession | null;
  result: PracticeResult | null;
  onStart: (tag: string) => void;
  onComplete: (payload: { answers: { mcqId: number; selectedIndex: number }[] }) => void;
  onChangeTopic: () => void;
  onExit: () => void;
}

export default function McqTopicPracticeView({
  allMcqs = [],
  session,
  result,
  onStart,
  onComplete,
  onChangeTopic,
  onExit,
}: McqTopicPracticeViewProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of allMcqs) {
      for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allMcqs]);

  if (result) {
    return (
      <section className="view view-enter">
        <div className="section-heading">
          <div>
            <h2>Practice complete</h2>
            <p className="muted">{result.tag}</p>
          </div>
        </div>
        <div className="diagnostic-result">
          <div className="diagnostic-score">
            <span className="diagnostic-score-value">{result.correct}</span>
            <span className="diagnostic-score-total">/{result.total}</span>
          </div>
          <div className="diagnostic-actions">
            <button className="btn btn-primary" onClick={() => onStart(result.tag)}>Practice {result.tag} again</button>
            <button className="btn btn-ghost" onClick={onChangeTopic}>Choose another topic</button>
            <button className="btn btn-ghost" onClick={onExit}>Back</button>
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
            <h2>MCQ practice</h2>
            <p className="muted">Pick a topic to drill — untimed, no scoring pressure, no weakness report.</p>
          </div>
        </div>
        {tagCounts.length === 0 ? (
          <div className="empty-state">
            <p>No MCQs yet. Generate some from your notes first.</p>
          </div>
        ) : (
          <div className="tags" style={{ marginBottom: '1rem' }}>
            {tagCounts.map(([tag, count]) => (
              <button key={tag} className="tag-filter" onClick={() => onStart(tag)}>
                {tag} <span className="muted">({count})</span>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  const mcq = session.mcqs[index];
  const answered = answers[mcq.id];
  const isAnswered = answered !== undefined;
  const isLast = index === session.mcqs.length - 1;
  const answeredCount = Object.keys(answers).length;

  const answer = (optionIdx: number) => {
    if (isAnswered) return;
    const nextAnswers = { ...answers, [mcq.id]: optionIdx };
    setAnswers(nextAnswers);
    if (isLast) {
      const payload = Object.entries(nextAnswers).map(([mcqId, selectedIndex]) => ({
        mcqId: Number(mcqId),
        selectedIndex,
      }));
      onComplete({ answers: payload });
    } else {
      setTimeout(() => setIndex((i) => i + 1), 700);
    }
  };

  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Practice · {session.tag} · {index + 1} / {session.mcqs.length}</h2>
          <p className="muted">{answeredCount} answered · Pick the best option.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onChangeTopic}>Change topic</button>
      </div>

      <div className="sprint-progress">
        <div className="sprint-progress-bar" style={{ width: `${((index + 1) / session.mcqs.length) * 100}%` }} />
      </div>

      <div className="sprint-item">
        <p className="sprint-question">{mcq.question}</p>
        <div className="sprint-mcq-options">
          {mcq.options.map((opt, idx) => {
            const isSelected = answered === idx;
            const isCorrect = idx === mcq.correctIndex;
            const cls = isAnswered
              ? (isCorrect ? 'correct' : isSelected ? 'wrong' : '')
              : '';
            return (
              <button
                key={idx}
                className={`sprint-mcq-option ${cls}`}
                disabled={isAnswered}
                onClick={() => answer(idx)}
              >
                <span className="sprint-mcq-letter">{String.fromCharCode(65 + idx)}</span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
        {isAnswered && mcq.explanation && (
          <p className="muted" style={{ marginTop: '1rem' }}>{mcq.explanation}</p>
        )}
      </div>
    </section>
  );
}
