'use client';

import { useMemo, type ReactNode } from 'react';
import Button from './ui/Button';
import { selectRoadmapNotes } from '@/lib/roadmaps';

interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  sourceUrl?: string;
}

interface RoadmapsViewProps {
  notes: Note[];
  onGenerate: (id: number) => void;
}

interface ContentBlock {
  type: 'paragraph' | 'list';
  lines: string[];
}

function parseContentBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let current: ContentBlock | null = null;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      current = null;
      continue;
    }
    const bullet = /^[-*+]\s+(.+)$/.exec(line);
    if (bullet) {
      if (!current || current.type !== 'list') {
        current = { type: 'list', lines: [] };
        blocks.push(current);
      }
      current.lines.push(bullet[1]);
    } else if (current?.type === 'list') {
      current.lines[current.lines.length - 1] += ` ${line}`;
    } else {
      if (!current) {
        current = { type: 'paragraph', lines: [] };
        blocks.push(current);
      }
      current.lines.push(line);
    }
  }
  return blocks;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*.+?\*\*|`.+?`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function roadmapKey(note: Note): string {
  return note.tags.find((tag) => /^R\d+$/.test(tag)) ?? '';
}

function roadmapSummary(content: string): string {
  const paragraph = content.split(/\n\s*\n/).find((block) => block.trim()) ?? '';
  return paragraph
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+[-*+]\s+/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

export default function RoadmapsView({ notes, onGenerate }: RoadmapsViewProps) {
  const roadmaps = useMemo(() => selectRoadmapNotes(notes), [notes]);

  return (
    <section className="view view-enter">
      <div className="section-heading">
        <div>
          <h2>Study Roadmaps</h2>
          <p className="muted">Open a roadmap when you’re ready to work through it.</p>
        </div>
      </div>
      <div className="stack">
        {roadmaps.length > 0 ? (
          roadmaps.map((note) => {
            const key = roadmapKey(note);
            return (
              <details className="roadmap-entry" key={note.id}>
                <summary className="roadmap-summary">
                  <span className="roadmap-key">{key}</span>
                  <span className="roadmap-summary-body">
                    <span className="roadmap-title">{note.title.replace(/^R\d+\s*[—-]\s*/, '')}</span>
                    <span className="roadmap-excerpt">{roadmapSummary(note.content)}</span>
                  </span>
                  <span className="roadmap-open-label">
                    <span className="roadmap-view-label">View</span>
                    <span className="roadmap-close-label">Close</span>
                  </span>
                </summary>
                <div className="roadmap-detail">
                  <div className="roadmap-content">
                    {parseContentBlocks(note.content).map((block, blockIndex) => block.type === 'list' ? (
                      <ul className="roadmap-list" key={blockIndex}>
                        {block.lines.map((line, lineIndex) => (
                          <li key={lineIndex}>{renderInline(line, `${key}-${blockIndex}-${lineIndex}`)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={blockIndex}>{renderInline(block.lines.join(' '), `${key}-${blockIndex}`)}</p>
                    ))}
                  </div>
                  <div className="actions">
                    <Button onClick={() => onGenerate(note.id)}>Generate Drafts</Button>
                  </div>
                </div>
              </details>
            );
          })
        ) : (
          <div className="empty-state">
            <p>
              No roadmaps loaded yet. Run{' '}
              <code>bun scripts/seed-roadmaps.ts</code> to register the sections in{' '}
              <code>docs/roadmaps.md</code> as notes.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
