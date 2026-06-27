'use client';

import { useMemo, useState } from 'react';
import Card from './ui/Card';
import Tag from './ui/Tag';
import Button from './ui/Button';
import { IconMC, IconX } from './ui/Icons';

interface Draft {
  id: number;
  question: string;
  expectedAnswer: string;
  rubric: string[];
  tags: string[];
}

interface DraftsViewProps {
  drafts: Draft[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onGenerateMCQs: () => void;
}

export default function DraftsView({ drafts, onApprove, onReject, onGenerateMCQs }: DraftsViewProps) {
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const d of drafts) {
      for (const t of d.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [drafts]);

  const filtered = useMemo(() => {
    if (!filterTag) return drafts;
    return drafts.filter((d) => d.tags.includes(filterTag));
  }, [drafts, filterTag]);

  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Draft Approval</h2>
          <p className="muted">Generated questions only enter review after approval.</p>
        </div>
        <Button variant="secondary" onClick={onGenerateMCQs}>
          <IconMC /> Generate More MCQs
        </Button>
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
          filtered.map((draft) => (
            <Card key={draft.id}>
              <h3 className="headline-sm">{draft.question}</h3>
              <p className="body-md">{draft.expectedAnswer}</p>
              {draft.rubric.length > 0 && (
                <ul className="rubric">
                  {draft.rubric.map((point: string, idx: number) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              )}
              <div className="tags">
                {draft.tags.map((tag: string) => (
                  <Tag key={tag} label={tag} />
                ))}
              </div>
              <div className="actions">
                <Button onClick={() => onApprove(draft.id)}>Approve</Button>
                <Button variant="secondary" onClick={() => onReject(draft.id)}>Reject</Button>
              </div>
            </Card>
          ))
        ) : (
          <div className="empty-state">
            {filterTag ? (
              <p>No drafts match the filter <strong>{filterTag}</strong>.</p>
            ) : (
              <p>No pending drafts. Sync notes and generate drafts to create practice cards.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
