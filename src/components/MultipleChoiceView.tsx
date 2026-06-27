'use client';

import Tag from './ui/Tag';
import Button from './ui/Button';
import { IconCheck, IconX } from './ui/Icons';

interface MCQ {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
}

interface MultipleChoiceViewProps {
  mcqs: MCQ[];
  mcqAnswered: Record<number, number>;
  onMcqAnswer: (mcqId: number, optionIdx: number) => void;
  activeIndex: number;
  onIndexChange: (idx: number) => void;
}

export default function MultipleChoiceView({
  mcqs,
  mcqAnswered,
  onMcqAnswer,
  activeIndex,
  onIndexChange,
}: MultipleChoiceViewProps) {
  if (mcqs.length === 0) {
    return (
      <div className="empty-state">
        <p>No multiple choice questions available. Sync notes and generate cards first.</p>
      </div>
    );
  }

  const activeMCQ = mcqs[activeIndex];
  const selectedOption = mcqAnswered[activeMCQ.id] ?? null;
  const answered = selectedOption !== null;
  const isCorrect = answered && selectedOption === activeMCQ.correctIndex;

  return (
    <article className="work-surface">
      <div className="mcq-nav">
        {mcqs.map((q, idx) => {
          const ans = mcqAnswered[q.id];
          let cls = 'mcq-nav-btn';
          if (idx === activeIndex) cls += ' current';
          else if (ans !== undefined) {
            cls += ans === q.correctIndex ? ' correct' : ' incorrect';
          }
          return (
            <button key={q.id} className={cls} onClick={() => onIndexChange(idx)} title={q.question.slice(0, 60)}>
              {idx + 1}
            </button>
          );
        })}
      </div>

      <h3 className="question">{activeMCQ.question}</h3>
      <div className="tags">
        {activeMCQ.tags.map((tag: string) => (
          <Tag key={tag} label={tag} />
        ))}
      </div>

      <div className="mcq-options">
        {activeMCQ.options.map((opt, idx) => {
          let cls = 'mcq-option';
          if (answered) {
            if (idx === activeMCQ.correctIndex) cls += ' correct';
            else if (idx === selectedOption) cls += ' incorrect';
          } else if (idx === selectedOption) {
            cls += ' selected';
          }
          return (
            <button
              key={idx}
              className={cls}
              onClick={() => !answered && onMcqAnswer(activeMCQ.id, idx)}
              disabled={answered}
            >
              <span className="mcq-marker">
                {answered && idx === activeMCQ.correctIndex ? (
                  <IconCheck className="mcq-icon-correct" />
                ) : answered && idx === selectedOption ? (
                  <IconX className="mcq-icon-incorrect" />
                ) : (
                  <span className="mcq-letter">{String.fromCharCode(65 + idx)}</span>
                )}
              </span>
              <span className="mcq-text">{opt}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={`mcq-result ${isCorrect ? 'correct' : 'incorrect'}`}>
          <h3>{isCorrect ? 'Correct' : 'Incorrect'}</h3>
          <p>{activeMCQ.explanation}</p>
        </div>
      )}
    </article>
  );
}
