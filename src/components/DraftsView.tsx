'use client';

import Card from './ui/Card';
import Tag from './ui/Tag';
import Button from './ui/Button';

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
}

export default function DraftsView({ drafts, onApprove, onReject }: DraftsViewProps) {
  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Draft Approval</h2>
          <p className="muted">Generated questions only enter review after approval.</p>
        </div>
      </div>
      <div className="stack">
        {drafts.length > 0 ? (
          drafts.map((draft) => (
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
            <p>No pending drafts. Sync notes and generate drafts to create practice cards.</p>
          </div>
        )}
      </div>
    </section>
  );
}
