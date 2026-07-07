'use client';

import { useMemo, useState } from 'react';
import Button from './ui/Button';
import { IconX } from './ui/Icons';

interface GenerateMCQsModalProps {
  notes: { tags: string[] }[];
  onConfirm: (topics: string[]) => void;
  onCancel: () => void;
}

export default function GenerateMCQsModal({ notes, onConfirm, onCancel }: GenerateMCQsModalProps) {
  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      for (const tag of note.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [notes]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = topicCounts.length > 0 && selected.size === topicCounts.length;

  const toggleTopic = (topic: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(topicCounts.map(([topic]) => topic)));
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="headline-sm">Generate More MCQs</h3>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            <IconX />
          </button>
        </div>
        <div className="modal-body">
          {topicCounts.length === 0 ? (
            <div className="empty-state">
              <p>No topics found. Sync notes from Notion first, or ensure your notes have topic tags.</p>
            </div>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: '0.75rem' }}>
                Choose which topics to generate new MCQs from.
              </p>
              <label className="topic-checkbox topic-checkbox-all">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                Select all
              </label>
              <div className="topic-checkbox-list">
                {topicCounts.map(([topic, count]) => (
                  <label key={topic} className="topic-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.has(topic)}
                      onChange={() => toggleTopic(topic)}
                    />
                    {topic} <span className="muted">({count} note{count === 1 ? '' : 's'})</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={topicCounts.length === 0 || selected.size === 0}
          >
            Generate
          </Button>
        </div>
      </div>
    </div>
  );
}
