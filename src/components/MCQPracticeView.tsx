'use client';

import { useMemo, useState } from 'react';
import { IconX } from './ui/Icons';

interface MCQ {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
}

interface DiagnosticSession {
  diagnosticId: number;
  mcqs: MCQ[];
  tag?: string | null;
}

interface WeaknessReport {
  entries: { tag: string; wrongCount: number; total: number }[];
  drillTargetTags: string[];
}

interface DiagnosticResult {
  score: number;
  weaknessReport: WeaknessReport;
}

interface MCQPracticeViewProps {
  session: DiagnosticSession | null;
  result: DiagnosticResult | null;
  allMcqs: MCQ[];
  onStart: (tag?: string) => void;
  onComplete: (payload: { answers: any[] }) => void;
  onDrillTags: (tags: string[]) => void;
  onExit: () => void;
}

export default function MCQPracticeView({
  session,
  result,
  allMcqs = [],
  onStart,
  onComplete,
  onDrillTags,
  onExit,
}: MCQPracticeViewProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMcqs) {
      for (const t of m.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [allMcqs]);

  if (result) {
    const { score, weaknessReport } = result;
    const canDrill = weaknessReport.drillTargetTags.length > 0;
    return (
      <section className="view view-enter">
        <div className="section-heading">
          <div>
            <h2>Weakness report</h2>
            <p className="muted">Where to focus next.</p>
          </div>
        </div>
        <div className="diagnostic-result">
          <div className="diagnostic-score">
            <span className="diagnostic-score-value">{score}</span>
            <span className="diagnostic-score-total">/{session?.mcqs.length ?? 15}</span>
          </div>
          <div className="diagnostic-breakdown">
            <h3>By tag</h3>
            {weaknessReport.entries.length === 0 ? (
              <p className="muted">No tag data.</p>
            ) : (
              <ul>
                {weaknessReport.entries.map((row) => {
                  const wrongPct = row.total === 0 ? 0 : Math.round((row.wrongCount / row.total) * 100);
                  const cls = wrongPct >= 50 ? 'weak' : wrongPct >= 25 ? 'meh' : 'ok';
                  return (
                    <li key={row.tag} className={`diagnostic-tag diagnostic-tag-${cls}`}>
                      <span className="diagnostic-tag-name">{row.tag}</span>
                      <span className="diagnostic-tag-wrong">{row.wrongCount}/{row.total} wrong</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="diagnostic-actions">
            {canDrill && (
              <button className="btn btn-primary" onClick={() => onDrillTags(weaknessReport.drillTargetTags)}>
                Drill {weaknessReport.drillTargetTags.length} weak tag{weaknessReport.drillTargetTags.length === 1 ? '' : 's'} now
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => onStart()}>Run another diagnostic</button>
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
            <h2>MCQ diagnostic</h2>
            <p className="muted">15 multiple-choice questions weighted to your weakest / stalest tags. Ends with a weakness report.</p>
          </div>
        </div>
        <div className="diagnostic-start">
          <p>Diagnostics don&apos;t train memory — they show you where to drill next. Takes ~8 minutes.</p>
          <p className="muted">Optionally restrict to one topic — otherwise it draws from every tag.</p>
          <div className="tags" style={{ marginBottom: '1rem' }}>
            {availableTags.length > 0 && !selectedTag && availableTags.map((tag) => (
              <button key={tag} className="tag-filter" onClick={() => setSelectedTag(tag)}>{tag}</button>
            ))}
            {selectedTag && (
              <button className="tag-filter active" onClick={() => setSelectedTag(null)}>
                {selectedTag} <IconX />
              </button>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => onStart(selectedTag || undefined)}>
            {selectedTag ? `Start diagnostic: ${selectedTag}` : 'Start diagnostic (all topics)'}
          </button>
        </div>
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
          <h2>Diagnostic{session.tag ? ` · ${session.tag}` : ''} · {index + 1} / {session.mcqs.length}</h2>
          <p className="muted">{answeredCount} answered · Pick the best option.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>Abandon</button>
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
      </div>
    </section>
  );
}
