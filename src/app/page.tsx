'use client';

import React, { useState, useEffect } from 'react';

export default function SPA() {
  const [view, setView] = useState<'practice' | 'drafts' | 'notes' | 'history' | 'settings'>('practice');
  const [stats, setStats] = useState({ dueCount: 0, draftCount: 0, reviewCount: 0 });
  const [notes, setNotes] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [dueCards, setDueCards] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ notion: {}, ai: { provider: 'offline' } });

  const [status, setStatus] = useState<{ message: string; isError?: boolean } | null>(null);

  // Practice state
  const [activeCard, setActiveCard] = useState<any>(null);
  const [activeStartedAt, setActiveStartedAt] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [aiCritique, setAiCritique] = useState<any>(null);

  useEffect(() => {
    loadSettings();
    loadState();
  }, []);

  const triggerStatus = (msg: string, isErr = false) => {
    setStatus({ message: msg, isError: isErr });
    setTimeout(() => setStatus(null), 5000);
  };

  async function api(path: string, options: any = {}) {
    const res = await fetch(path, {
      method: options.method || 'GET',
      headers: { 'content-type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Request failed.');
    return payload;
  }

  async function loadSettings() {
    try {
      const data = await api('/api/settings');
      setSettings(data);
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }

  async function loadState() {
    try {
      const data = await api('/api/state');
      setStats(data.stats);
      setNotes(data.notes);
      setDrafts(data.drafts);
      setDueCards(data.dueCards);
      setReviews(data.reviews);

      if (data.dueCards.length > 0) {
        if (!activeCard) {
          setActiveCard(data.dueCards[0]);
          setActiveStartedAt(Date.now());
        }
      } else {
        setActiveCard(null);
      }
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const target = e.currentTarget as any;
    const body = {
      notion: {
        token: target.token.value.trim(),
        databaseId: target.databaseId.value.trim(),
        titleProperty: target.titleProperty.value.trim() || 'Name',
        topicProperty: target.topicProperty.value.trim() || 'Topic',
        topics: target.topics.value.split(',').map((t: string) => t.trim()).filter(Boolean)
      },
      ai: {
        provider: target.provider.value,
        apiKey: target.apiKey.value.trim(),
        baseUrl: target.baseUrl.value.trim(),
        model: target.model.value.trim()
      }
    };
    try {
      await api('/api/settings', { method: 'POST', body });
      triggerStatus('Settings saved.');
      await loadSettings();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleSyncNotion() {
    triggerStatus('Syncing Notion...');
    try {
      const result = await api('/api/notion/sync', { method: 'POST', body: {} });
      triggerStatus(`Synced ${result.imported} notes.`);
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleGenerateDrafts(noteId: number) {
    triggerStatus('Generating drafts...');
    try {
      const result = await api(`/api/notes/${noteId}/generate`, { method: 'POST', body: {} });
      triggerStatus(`Generated ${result.drafts.length} drafts.`);
      await loadState();
      setView('drafts');
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleApproveDraft(id: number) {
    try {
      await api(`/api/drafts/${id}/approve`, { method: 'POST', body: {} });
      triggerStatus('Draft approved.');
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleRejectDraft(id: number) {
    try {
      await api(`/api/drafts/${id}/reject`, { method: 'POST', body: {} });
      triggerStatus('Draft rejected.');
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleRequestCritique() {
    if (!userAnswer.trim()) {
      triggerStatus('Write an answer before requesting critique.', true);
      return;
    }
    try {
      const result = await api(`/api/cards/${activeCard.id}/critique`, {
        method: 'POST',
        body: { answer: userAnswer.trim() }
      });
      setAiCritique(result.critique);
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleSubmitReview(rating: string) {
    if (!userAnswer.trim()) {
      triggerStatus('Write an answer before grading the card.', true);
      return;
    }
    try {
      await api(`/api/cards/${activeCard.id}/review`, {
        method: 'POST',
        body: {
          answer: userAnswer.trim(),
          aiFeedback: aiCritique,
          rating,
          elapsedSeconds: Math.round((Date.now() - (activeStartedAt || Date.now())) / 1000)
        }
      });
      setUserAnswer('');
      setShowAnswerKey(false);
      setAiCritique(null);
      setActiveCard(null);
      setActiveStartedAt(null);
      triggerStatus('Review saved.');
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <h1>Interview Memory</h1>
          <p className="muted">Notion-powered spaced interview practice</p>
        </div>
        <nav className="nav">
          <button onClick={() => setView('practice')} className={view === 'practice' ? 'active' : ''}>Practice</button>
          <button onClick={() => setView('drafts')} className={view === 'drafts' ? 'active' : ''}>Drafts</button>
          <button onClick={() => setView('notes')} className={view === 'notes' ? 'active' : ''}>Notes</button>
          <button onClick={() => setView('history')} className={view === 'history' ? 'active' : ''}>History</button>
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'active' : ''}>Settings</button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="metric">
            <span>{stats.dueCount}</span>
            <small>Due</small>
          </div>
          <div className="metric">
            <span>{stats.draftCount}</span>
            <small>Drafts</small>
          </div>
          <div className="metric">
            <span>{stats.reviewCount}</span>
            <small>Reviews</small>
          </div>
          <button onClick={loadState}>Refresh</button>
        </header>

        {status && (
          <section className={`status ${status.isError ? 'error' : ''}`}>
            {status.message}
          </section>
        )}

        {view === 'practice' && (
          <section className="view active">
            <div className="section-heading">
              <div>
                <h2>Interview Practice</h2>
                <p className="muted">Answer due cards aloud or in writing, then self-grade.</p>
              </div>
            </div>
            <article className="work-surface">
              {activeCard ? (
                <>
                  <h3>{activeCard.question}</h3>
                  <div className="tags">
                    {activeCard.tags.map((tag: string) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                  <div className="answer-panel">
                    <textarea
                      placeholder="Answer as if an interviewer asked you this question."
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                    />
                    <div className="actions">
                      <button onClick={handleRequestCritique} className="secondary">AI Critique</button>
                      <button onClick={() => setShowAnswerKey(true)} className="secondary">Show Answer</button>
                    </div>

                    {showAnswerKey && (
                      <div id="answerKey">
                        <h3>Expected Answer</h3>
                        <p>{activeCard.expectedAnswer}</p>
                        <h3>Rubric</h3>
                        <ul className="rubric">
                          {activeCard.rubric.map((point: string, idx: number) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
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
                      <button onClick={() => handleSubmitReview('again')} className="danger">Again</button>
                      <button onClick={() => handleSubmitReview('hard')} className="secondary">Hard</button>
                      <button onClick={() => handleSubmitReview('good')}>Good</button>
                      <button onClick={() => handleSubmitReview('easy')}>Easy</button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="muted">No cards are due. Approve drafts or come back when scheduled cards are ready.</p>
              )}
            </article>
          </section>
        )}

        {view === 'drafts' && (
          <section className="view active">
            <div className="section-heading">
              <div>
                <h2>Draft Approval</h2>
                <p className="muted">Generated questions only enter review after approval.</p>
              </div>
            </div>
            <div className="stack">
              {drafts.length > 0 ? (
                drafts.map((draft) => (
                  <article key={draft.id} className="item">
                    <h3>{draft.question}</h3>
                    <p>{draft.expectedAnswer}</p>
                    <ul className="rubric">
                      {draft.rubric.map((point: string, idx: number) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                    <div className="tags">
                      {draft.tags.map((tag: string) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                    <div className="actions">
                      <button onClick={() => handleApproveDraft(draft.id)}>Approve</button>
                      <button onClick={() => handleRejectDraft(draft.id)} className="secondary">Reject</button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted">No pending drafts.</p>
              )}
            </div>
          </section>
        )}

        {view === 'notes' && (
          <section className="view active">
            <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>Notion Notes</h2>
                <p className="muted">Sync selected topics, then generate interview questions.</p>
              </div>
              <button onClick={handleSyncNotion}>Sync Notion</button>
            </div>
            <div className="stack">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <article key={note.id} className="item">
                    <h3>{note.title}</h3>
                    <p className="muted">
                      {note.content.slice(0, 220)}
                      {note.content.length > 220 ? '...' : ''}
                    </p>
                    <div className="tags">
                      {note.tags.map((tag: string) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                    <div className="actions">
                      <button onClick={() => handleGenerateDrafts(note.id)}>Generate Drafts</button>
                      {note.sourceUrl && (
                        <a href={note.sourceUrl} target="_blank" rel="noreferrer" style={{ alignSelf: 'center' }}>Open Notion</a>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted">No notes synced yet.</p>
              )}
            </div>
          </section>
        )}

        {view === 'history' && (
          <section className="view active">
            <div className="section-heading">
              <div>
                <h2>Review History</h2>
                <p className="muted">Recent answers, ratings, and feedback.</p>
              </div>
            </div>
            <div className="stack">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <article key={review.id} className="item">
                    <h3>{review.rating.toUpperCase()}</h3>
                    <p>{review.userAnswer}</p>
                    {review.aiFeedback && <p className="muted">AI: {review.aiFeedback.summary}</p>}
                    <p className="muted">{new Date(review.reviewedAt).toLocaleString()}</p>
                  </article>
                ))
              ) : (
                <p className="muted">No reviews yet.</p>
              )}
            </div>
          </section>
        )}

        {view === 'settings' && (
          <section className="view active">
            <div className="section-heading">
              <div>
                <h2>Settings</h2>
                <p className="muted">Local-only configuration for Notion and AI providers.</p>
              </div>
            </div>
            <form onSubmit={handleSaveSettings} className="settings-grid">
              <label>Notion token <input name="token" type="password" defaultValue={settings.notion?.token || ''} /></label>
              <label>Notion database ID <input name="databaseId" defaultValue={settings.notion?.databaseId || ''} /></label>
              <label>Title property <input name="titleProperty" defaultValue={settings.notion?.titleProperty || 'Name'} /></label>
              <label>Topic property <input name="topicProperty" defaultValue={settings.notion?.topicProperty || 'Topic'} /></label>
              <label>Topic filters <input name="topics" placeholder="System Design,JavaScript" defaultValue={Array.isArray(settings.notion?.topics) ? settings.notion.topics.join(',') : ''} /></label>
              <label>AI provider
                <select name="provider" defaultValue={settings.ai?.provider || 'offline'}>
                  <option value="offline">Offline deterministic</option>
                  <option value="openai-compatible">OpenAI-compatible</option>
                </select>
              </label>
              <label>AI API key <input name="apiKey" type="password" defaultValue={settings.ai?.apiKey || ''} /></label>
              <label>AI base URL <input name="baseUrl" placeholder="https://api.openai.com/v1" defaultValue={settings.ai?.baseUrl || ''} /></label>
              <label>AI model <input name="model" placeholder="gpt-4.1-mini" defaultValue={settings.ai?.model || ''} /></label>
              <button type="submit">Save Settings</button>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
