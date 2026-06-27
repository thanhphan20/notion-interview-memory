'use client';

import { useMemo, useState } from 'react';
import Button from './ui/Button';
import Tag from './ui/Tag';
import MultipleChoiceView from './MultipleChoiceView';
import { IconCritique, IconEye, IconMC, IconShuffle, IconX } from './ui/Icons';

interface Card {
  id: number;
  question: string;
  expectedAnswer: string;
  rubric: string[];
  tags: string[];
}

interface MCQ {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
}

interface Critique {
  summary: string;
  suggestedRating: string;
  missingKeyPoints: string[];
}

interface PracticeViewProps {
  activeCard: Card | null;
  userAnswer: string;
  setUserAnswer: (v: string) => void;
  showAnswerKey: boolean;
  setShowAnswerKey: (v: boolean) => void;
  aiCritique: Critique | null;
  onCritique: () => void;
  onReview: (rating: string) => void;
  practiceMode: 'open' | 'mcq';
  onPracticeModeChange: (mode: 'open' | 'mcq') => void;
  mcqCards: MCQ[];
  mcqAnswered: Record<number, number>;
  onMcqAnswer: (mcqId: number, optionIdx: number) => void;
  activeMCQIndex: number;
  onMcqIndexChange: (idx: number) => void;
  onShuffleMCQs: () => void;
  dueCards?: Card[];
  cardFilterTag?: string | null;
  onCardFilterChange?: (tag: string | null) => void;
}

export default function PracticeView({
  activeCard,
  userAnswer,
  setUserAnswer,
  showAnswerKey,
  setShowAnswerKey,
  aiCritique,
  onCritique,
  onReview,
  practiceMode,
  onPracticeModeChange,
  mcqCards,
  mcqAnswered,
  onMcqAnswer,
  activeMCQIndex,
  onMcqIndexChange,
  onShuffleMCQs,
  dueCards = [],
  cardFilterTag,
  onCardFilterChange,
}: PracticeViewProps) {
  const [mcqFilterTag, setMcqFilterTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const m of mcqCards) {
      for (const t of m.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [mcqCards]);

  const filteredMCQs = useMemo(() => {
    if (!mcqFilterTag) return mcqCards;
    return mcqCards.filter((m) => m.tags.includes(mcqFilterTag));
  }, [mcqCards, mcqFilterTag]);

  const cardTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of dueCards) {
      for (const t of c.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [dueCards]);

  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Interview Practice</h2>
          <p className="muted">Answer due cards aloud or in writing, then self-grade.</p>
        </div>
      </div>

      <div className="practice-tabs">
        <button
          className={`practice-tab ${practiceMode === 'open' ? 'active' : ''}`}
          onClick={() => onPracticeModeChange('open')}
        >
          <IconCritique />
          Open Recall
        </button>
        <button
          className={`practice-tab ${practiceMode === 'mcq' ? 'active' : ''}`}
          onClick={() => onPracticeModeChange('mcq')}
        >
          <IconMC />
          Multiple Choice
        </button>
      </div>

      {practiceMode === 'mcq' ? (
        <>
          <div className="tags" style={{ marginBottom: '1rem', minHeight: '1.5rem' }}>
            <button className="tag-filter shuffle-btn" onClick={onShuffleMCQs} title="Shuffle questions">
              <IconShuffle />
            </button>
            {mcqFilterTag ? (
              <button className="tag-filter active" onClick={() => { setMcqFilterTag(null); onMcqIndexChange(0); }}>
                {mcqFilterTag} <IconX />
              </button>
            ) : (
              allTags.map((tag) => (
                <button key={tag} className="tag-filter" onClick={() => { setMcqFilterTag(tag); onMcqIndexChange(0); }}>
                  {tag}
                </button>
              ))
            )}
          </div>
          <MultipleChoiceView
            mcqs={filteredMCQs}
            mcqAnswered={mcqAnswered}
            onMcqAnswer={onMcqAnswer}
            activeIndex={Math.min(activeMCQIndex, filteredMCQs.length - 1)}
            onIndexChange={onMcqIndexChange}
          />
        </>
      ) : (
        <>
          <div className="tags" style={{ marginBottom: '1rem', minHeight: '1.5rem' }}>
            {cardTags.length > 0 && !cardFilterTag && cardTags.map((tag) => (
              <button key={tag} className="tag-filter" onClick={() => onCardFilterChange?.(tag)}>{tag}</button>
            ))}
            {cardFilterTag && (
              <button className="tag-filter active" onClick={() => onCardFilterChange?.(null)}>
                {cardFilterTag} <IconX />
              </button>
            )}
          </div>
          <article className="work-surface">
          {activeCard ? (
            <>
              <h3 className="question">{activeCard.question}</h3>
              <div className="tags">
                {activeCard.tags.map((tag: string) => (
                  <Tag key={tag} label={tag} />
                ))}
              </div>
              <div className="answer-panel">
                <textarea
                  placeholder="Answer as if an interviewer asked you this question."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                />
                <div className="actions">
                  <Button variant="secondary" onClick={onCritique}><IconCritique /> AI Critique</Button>
                  <Button variant="secondary" onClick={() => setShowAnswerKey(true)}><IconEye /> Show Answer</Button>
                </div>

                {showAnswerKey && (
                  <div className="answer-key">
                    <div>
                      <h3>Expected Answer</h3>
                      <p>{activeCard.expectedAnswer}</p>
                    </div>
                    <div>
                      <h3>Rubric</h3>
                      <ul className="rubric">
                        {activeCard.rubric.map((point: string, idx: number) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {aiCritique && (
                  <div className="feedback">
                    <h3>AI Critique</h3>
                    <p>{aiCritique.summary}</p>
                    <p className="muted">Suggested rating: {aiCritique.suggestedRating}</p>
                    {aiCritique.missingKeyPoints.length > 0 && (
                      <ul className="rubric">
                        {aiCritique.missingKeyPoints.map((point: string, idx: number) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="actions" style={{ marginTop: '1.5rem' }}>
                  <Button variant="danger" onClick={() => onReview('again')}>Again</Button>
                  <Button variant="secondary" onClick={() => onReview('hard')}>Hard</Button>
                  <Button onClick={() => onReview('good')}>Good</Button>
                  <Button onClick={() => onReview('easy')}>Easy</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>No cards are due. Approve drafts or come back when scheduled cards are ready.</p>
            </div>
          )}
        </article>
        </>
      )}
    </section>
  );
}
