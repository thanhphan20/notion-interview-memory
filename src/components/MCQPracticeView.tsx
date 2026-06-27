'use client';

import { useMemo, useState } from 'react';
import MultipleChoiceView from './MultipleChoiceView';
import { IconShuffle, IconX } from './ui/Icons';

interface MCQ {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
}

interface MCQPracticeViewProps {
  mcqs: MCQ[];
  mcqAnswered: Record<number, number>;
  onMcqAnswer: (mcqId: number, optionIdx: number) => void;
  activeMCQIndex: number;
  onMcqIndexChange: (idx: number) => void;
  onShuffleMCQs: () => void;
}

export default function MCQPracticeView({
  mcqs,
  mcqAnswered,
  onMcqAnswer,
  activeMCQIndex,
  onMcqIndexChange,
  onShuffleMCQs,
}: MCQPracticeViewProps) {
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const m of mcqs) {
      for (const t of m.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [mcqs]);

  const filtered = useMemo(() => {
    if (!filterTag) return mcqs;
    return mcqs.filter((m) => m.tags.includes(filterTag));
  }, [mcqs, filterTag]);

  return (
    <>
      <div className="tags" style={{ marginBottom: '1rem', minHeight: '1.5rem' }}>
        <button className="tag-filter shuffle-btn" onClick={onShuffleMCQs} title="Shuffle questions">
          <IconShuffle />
        </button>
        {filterTag ? (
          <button className="tag-filter active" onClick={() => { setFilterTag(null); onMcqIndexChange(0); }}>
            {filterTag} <IconX />
          </button>
        ) : (
          allTags.map((tag) => (
            <button key={tag} className="tag-filter" onClick={() => { setFilterTag(tag); onMcqIndexChange(0); }}>
              {tag}
            </button>
          ))
        )}
      </div>
      <MultipleChoiceView
        mcqs={filtered}
        mcqAnswered={mcqAnswered}
        onMcqAnswer={onMcqAnswer}
        activeIndex={Math.min(activeMCQIndex, filtered.length - 1)}
        onIndexChange={onMcqIndexChange}
      />
    </>
  );
}
