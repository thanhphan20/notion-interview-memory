'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChecklistItem } from '@/lib/database';
import { api } from '@/lib/api-client';

interface ChecklistGroup {
  key: string;
  partKey: string;
  partTitle: string;
  sectionTitle: string;
  category: string | null;
  items: ChecklistItem[];
  complete: number;
}

const STATUS_LABELS: Record<NonNullable<ChecklistItem['sourceStatus']>, string> = {
  '✅': 'Drilled strong',
  '🟡': 'Drilled shallow',
  '🔴': 'Still open',
  '⚠️': 'Decision',
};

const CLAIM_LABELS: Record<string, string> = {
  CV: 'CV-grounded',
  JD: 'Job-description gap; do not claim',
  FUND: 'Fundamentals',
};

function getPartNumber(partKey: string): number {
  return Number(partKey.replace(/^part-/, '')) || Number.MAX_SAFE_INTEGER;
}

function cleanPartTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, '').replace(/`([^`]+)`/g, '$1');
}

function cleanSectionTitle(title: string): string {
  return cleanPartTitle(title).replace(/^PART\s+\d+\s*[—-]\s*/i, '');
}

function renderInlineText(text: string, prefix: string) {
  return text.split(/(\*\*.+?\*\*|`.+?`|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${prefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${prefix}-${index}`}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={`${prefix}-${index}`}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function makeGroups(items: ChecklistItem[]): ChecklistGroup[] {
  const groups = new Map<string, ChecklistGroup>();
  for (const item of items) {
    const key = [item.partKey, item.sectionTitle, item.category ?? ''].join('\u001f');
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        partKey: item.partKey,
        partTitle: item.partTitle,
        sectionTitle: item.sectionTitle,
        category: item.category,
        items: [],
        complete: 0,
      };
      groups.set(key, group);
    }
    group.items.push(item);
    if (item.done) group.complete++;
  }
  return [...groups.values()];
}

export default function ChecklistView() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePart, setActivePart] = useState('part-1');
  const [query, setQuery] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedTakeaways, setExpandedTakeaways] = useState<Set<number>>(() => new Set());
  const [takeawayDrafts, setTakeawayDrafts] = useState<Record<number, string>>({});
  const [busyItems, setBusyItems] = useState<Set<number>>(() => new Set());
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  async function loadChecklist() {
    try {
      const result = await api.getChecklist();
      setItems(result.items);
      if (result.items.length > 0 && !result.items.some((item) => item.partKey === activePart)) {
        setActivePart(result.items[0].partKey);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load the checklist.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    void api.getChecklist()
      .then((result) => {
        if (!mounted) return;
        setItems(result.items);
        if (result.items.length > 0 && !result.items.some((item) => item.partKey === 'part-1')) {
          setActivePart(result.items[0].partKey);
        }
      })
      .catch((error: unknown) => {
        if (mounted) setLoadError(error instanceof Error ? error.message : 'Could not load the checklist.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const parts = useMemo(() => {
    const byPart = new Map<string, { title: string; done: number; total: number }>();
    for (const item of items) {
      const part = byPart.get(item.partKey) ?? { title: item.partTitle, done: 0, total: 0 };
      part.total++;
      if (item.done) part.done++;
      byPart.set(item.partKey, part);
    }
    return [...byPart.entries()].sort(([left], [right]) => getPartNumber(left) - getPartNumber(right));
  }, [items]);

  const completedCount = useMemo(() => items.filter((item) => item.done).length, [items]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      return items.filter((item) => [
        item.sourceText,
        item.partTitle,
        item.sectionTitle,
        item.category ?? '',
        ...item.claimFlags,
      ].join(' ').toLowerCase().includes(normalizedQuery));
    }
    return items.filter((item) => item.partKey === activePart);
  }, [activePart, items, query]);
  const groups = useMemo(() => makeGroups(filteredItems), [filteredItems]);

  function setItemBusy(id: number, busy: boolean) {
    setBusyItems((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function toggleDone(item: ChecklistItem) {
    const done = !item.done;
    setFeedback(null);
    setItemBusy(item.id, true);
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, done } : candidate));
    try {
      const result = await api.updateChecklistItem(item.id, { done });
      setItems((current) => current.map((candidate) => candidate.id === item.id ? result.item : candidate));
    } catch (error) {
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, done: item.done } : candidate));
      setFeedback({
        message: error instanceof Error ? error.message : 'Could not save checklist progress.',
        isError: true,
      });
    } finally {
      setItemBusy(item.id, false);
    }
  }

  async function saveTakeaway(item: ChecklistItem, takeaway: string) {
    if (takeaway === item.takeaway) return;
    setFeedback(null);
    setItemBusy(item.id, true);
    try {
      const result = await api.updateChecklistItem(item.id, { takeaway });
      setItems((current) => current.map((candidate) => candidate.id === item.id ? result.item : candidate));
      setTakeawayDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setFeedback({ message: 'Key takeaway saved.', isError: false });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Could not save the key takeaway.',
        isError: true,
      });
    } finally {
      setItemBusy(item.id, false);
    }
  }

  if (loading) {
    return (
      <section className="view view-enter checklist-view" aria-busy="true">
        <h2>Revision checklist</h2>
        <p className="muted" role="status">Loading your checklist…</p>
        <div className="checklist-loading-lines" aria-hidden="true"><span /><span /><span /></div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="view view-enter checklist-view">
        <h2>Revision checklist</h2>
        <div className="checklist-message is-error" role="alert">
          <p>{loadError}</p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              void loadChecklist();
            }}
          >Retry</button>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="view view-enter checklist-view">
        <h2>Revision checklist</h2>
        <div className="empty-state checklist-empty">
          <p>No checklist items are imported yet.</p>
          <p className="muted">Run <code>bun scripts/import-checklist.ts</code> from the app folder to load your revision checklist.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="view view-enter checklist-view">
      <header className="checklist-header">
        <div>
          <h2>Revision checklist</h2>
          <p className="muted">Work through a topic, check it off, then write the takeaway you want to remember.</p>
        </div>
        <div className="checklist-overall" aria-label={`${completedCount} of ${items.length} checklist items complete`}>
          <span className="checklist-overall-count">{completedCount}<span> / {items.length}</span></span>
          <progress value={completedCount} max={items.length} aria-label="Overall checklist progress" />
          <span className="label-sm">COMPLETE</span>
        </div>
      </header>

      <nav className="checklist-parts" aria-label="Checklist parts">
        {parts.map(([partKey, part], index) => (
          <button
            key={partKey}
            type="button"
            className={`checklist-part${!query && activePart === partKey ? ' active' : ''}`}
            aria-pressed={!query && activePart === partKey}
            onClick={() => {
              setQuery('');
              setActivePart(partKey);
              setExpandedGroup(null);
            }}
          >
            <span className="checklist-part-number">PART {index + 1}</span>
            <span className="checklist-part-title">{cleanPartTitle(part.title).replace(/^PART\s+\d+\s*[—-]\s*/i, '')}</span>
            <span className="checklist-part-count">{part.done} / {part.total}</span>
          </button>
        ))}
      </nav>

      <div className="checklist-tools">
        <label className="checklist-search-label" htmlFor="checklist-search">Search all parts</label>
                <input
                  id="checklist-search"
          className="checklist-search"
                  type="search"
                  aria-label="Search all checklist parts"
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setExpandedGroup(null);
          }}
          placeholder="Search topics, tags, or sections"
        />
        {query.trim() && <span className="muted checklist-result-count">{filteredItems.length} matches across all parts</span>}
      </div>

      {feedback && (
        <p className={`checklist-message ${feedback.isError ? 'is-error' : 'is-success'}`} role={feedback.isError ? 'alert' : 'status'}>
          {feedback.message}
        </p>
      )}

      <div className="checklist-groups">
        {groups.map((group) => {
          const isExpanded = expandedGroup === group.key;
          const title = group.category ?? cleanSectionTitle(group.sectionTitle);
          return (
            <section className="checklist-group" key={group.key}>
              <button
                type="button"
                className="checklist-group-toggle"
                aria-expanded={isExpanded}
                onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
              >
                <span className="checklist-group-heading">
                  {query.trim() && (group.category || group.sectionTitle !== group.partTitle) && (
                    <span className="checklist-context">{cleanSectionTitle(group.partTitle)} · </span>
                  )}
                  <span>{title}</span>
                  {group.category && <small>{group.sectionTitle}</small>}
                </span>
                <span className="checklist-group-progress">{group.complete}/{group.items.length}</span>
                <span className="checklist-chevron" aria-hidden="true">{isExpanded ? '−' : '+'}</span>
              </button>

              {isExpanded && (
                <ul className="checklist-items">
                  {group.items.map((item) => {
                    const takeawayIsOpen = expandedTakeaways.has(item.id);
                    const takeawayValue = takeawayDrafts[item.id] ?? item.takeaway;
                    return (
                      <li className={`checklist-item${item.done ? ' is-done' : ''}`} key={item.id}>
                        <div className="checklist-item-main">
                          <label className="checklist-item-check">
                            <input
                              type="checkbox"
                              aria-label={`${item.done ? 'Mark incomplete' : 'Mark complete'}: ${item.sourceText.replace(/[*`]/g, '')}`}
                              checked={item.done}
                              disabled={busyItems.has(item.id)}
                              onChange={() => void toggleDone(item)}
                            />
                            <span>{renderInlineText(item.sourceText, `item-${item.id}`)}</span>
                          </label>
                          <div className="checklist-item-badges">
                            {item.sourceStatus && (
                              <span className="checklist-badge source-status" title={STATUS_LABELS[item.sourceStatus]}>
                                <span aria-hidden="true">{item.sourceStatus}</span> {STATUS_LABELS[item.sourceStatus]}
                              </span>
                            )}
                            {item.claimFlags.map((flag) => (
                              <span className={`checklist-badge claim-${flag.toLowerCase()}`} key={flag} title={CLAIM_LABELS[flag] ?? flag}>
                                {flag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="checklist-takeaway">
                          <button
                            type="button"
                            className="checklist-takeaway-toggle"
                            aria-expanded={takeawayIsOpen}
                            aria-controls={`takeaway-${item.id}`}
                            aria-label={`${item.takeaway ? 'Edit' : 'Add'} key takeaway for ${item.sourceText.replace(/[*`]/g, '')}`}
                            onClick={() => setExpandedTakeaways((current) => {
                              const next = new Set(current);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            })}
                          >
                            {item.takeaway ? 'Key takeaway' : 'Add key takeaway'}
                          </button>
                          {!takeawayIsOpen && item.takeaway && <p className="checklist-takeaway-preview">{item.takeaway}</p>}
                          {takeawayIsOpen && (
                            <label className="checklist-takeaway-editor" id={`takeaway-${item.id}`}>
                              <span>Key takeaway</span>
                              <textarea
                                rows={2}
                                aria-label={`Key takeaway for ${item.sourceText.replace(/[*`]/g, '')}`}
                                value={takeawayValue}
                                disabled={busyItems.has(item.id)}
                                onChange={(event) => {
                                  const value = event.currentTarget.value;
                                  setTakeawayDrafts((current) => ({ ...current, [item.id]: value }));
                                }}
                                onBlur={(event) => {
                                  if (event.relatedTarget instanceof HTMLButtonElement && event.relatedTarget.classList.contains('checklist-takeaway-save')) return;
                                  void saveTakeaway(item, event.currentTarget.value);
                                }}
                              />
                              <div className="checklist-takeaway-actions">
                                <small>{busyItems.has(item.id) ? 'Saving…' : 'Saves on blur or with Save'}</small>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm checklist-takeaway-save"
                                  aria-label={`Save key takeaway for ${item.sourceText.replace(/[*`]/g, '')}`}
                                  disabled={busyItems.has(item.id)}
                                  onClick={() => void saveTakeaway(item, takeawayValue)}
                                >Save</button>
                              </div>
                            </label>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {groups.length === 0 && <p className="empty-state">No topics match this search.</p>}
      </div>
    </section>
  );
}
