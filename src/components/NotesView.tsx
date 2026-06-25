'use client';

import Card from './ui/Card';
import Tag from './ui/Tag';
import Button from './ui/Button';

interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  sourceUrl?: string;
}

interface NotesViewProps {
  notes: Note[];
  onGenerate: (id: number) => void;
  onGenerateAll: () => void;
  onSync: () => void;
}

export default function NotesView({ notes, onGenerate, onGenerateAll, onSync }: NotesViewProps) {
  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Notion Notes</h2>
          <p className="muted">Sync selected topics, then generate interview questions.</p>
        </div>
        <div className="actions" style={{ gap: '0.5rem' }}>
          <Button onClick={onGenerateAll}>Generate from All</Button>
          <Button variant="secondary" onClick={onSync}>Sync Notion</Button>
        </div>
      </div>
      <div className="stack">
        {notes.length > 0 ? (
          notes.map((note) => (
            <Card key={note.id}>
              <h3 className="headline-sm">{note.title}</h3>
              <p className="muted">
                {note.content.slice(0, 220)}
                {note.content.length > 220 ? '...' : ''}
              </p>
              <div className="tags">
                {note.tags.map((tag: string) => (
                  <Tag key={tag} label={tag} />
                ))}
              </div>
              <div className="actions">
                <Button onClick={() => onGenerate(note.id)}>Generate Drafts</Button>
                {note.sourceUrl && (
                  <Button variant="secondary" href={note.sourceUrl}>
                    Open Notion
                  </Button>
                )}
              </div>
            </Card>
          ))
        ) : (
          <div className="empty-state">
            <p>No notes synced yet. Configure your Notion settings and sync to get started.</p>
          </div>
        )}
      </div>
    </section>
  );
}
