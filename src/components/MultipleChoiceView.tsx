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
  mcq: MCQ | null;
  selectedOption: number | null;
  onSelectOption: (idx: number) => void;
  onNext: () => void;
  mcqsRemaining: number;
}

export default function MultipleChoiceView({
  mcq,
  selectedOption,
  onSelectOption,
  onNext,
  mcqsRemaining,
}: MultipleChoiceViewProps) {
  if (!mcq) {
    return (
      <div className="empty-state">
        <p>No multiple choice questions available. Sync notes and generate cards first.</p>
      </div>
    );
  }

  const answered = selectedOption !== null;
  const isCorrect = answered && selectedOption === mcq.correctIndex;

  return (
    <article className="work-surface">
      <h3 className="question">{mcq.question}</h3>
      <div className="tags">
        {mcq.tags.map((tag: string) => (
          <Tag key={tag} label={tag} />
        ))}
      </div>

      <div className="mcq-options">
        {mcq.options.map((opt, idx) => {
          let cls = 'mcq-option';
          if (answered) {
            if (idx === mcq.correctIndex) cls += ' correct';
            else if (idx === selectedOption) cls += ' incorrect';
          } else if (idx === selectedOption) {
            cls += ' selected';
          }
          return (
            <button
              key={idx}
              className={cls}
              onClick={() => !answered && onSelectOption(idx)}
              disabled={answered}
            >
              <span className="mcq-marker">
                {answered && idx === mcq.correctIndex ? (
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
          <p>{mcq.explanation}</p>
        </div>
      )}

      {answered && (
        <div className="actions" style={{ marginTop: '1rem' }}>
          <Button onClick={onNext}>
            {mcqsRemaining > 0 ? `Next Question (${mcqsRemaining} remaining)` : 'Done'}
          </Button>
        </div>
      )}
    </article>
  );
}
