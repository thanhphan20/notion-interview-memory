'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import Toast from '@/components/ui/Toast';
import PracticeView from '@/components/PracticeView';
import DraftsView from '@/components/DraftsView';
import NotesView from '@/components/NotesView';
import HistoryView from '@/components/HistoryView';
import SettingsView from '@/components/SettingsView';
import {
  USE_MOCK,
  mockStats,
  mockCards,
  mockNotes,
  mockDrafts,
  mockReviews,
  mockSettings,
} from '@/lib/mock-data';

type ViewType = 'practice' | 'drafts' | 'notes' | 'history' | 'settings';

export default function SPA() {
  const [view, setView] = useState<ViewType>('practice');
  const [stats, setStats] = useState(USE_MOCK ? mockStats : { dueCount: 0, draftCount: 0, reviewCount: 0 });
  const [notes, setNotes] = useState<any[]>(USE_MOCK ? mockNotes : []);
  const [drafts, setDrafts] = useState<any[]>(USE_MOCK ? mockDrafts : []);
  const [dueCards, setDueCards] = useState<any[]>(USE_MOCK ? mockCards : []);
  const [reviews, setReviews] = useState<any[]>(USE_MOCK ? mockReviews : []);
  const [settings, setSettings] = useState<any>(USE_MOCK ? mockSettings : { notion: {}, ai: { provider: 'offline' } });
  const [status, setStatus] = useState<{ message: string; isError?: boolean } | null>(null);
  const [activeCard, setActiveCard] = useState<any>(USE_MOCK ? mockCards[0] : null);
  const [activeStartedAt, setActiveStartedAt] = useState<number | null>(USE_MOCK ? Date.now() : null);
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
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Request failed.');
    return payload;
  }

  async function loadSettings() {
    if (USE_MOCK) return;
    try {
      const data = await api('/api/settings');
      setSettings(data);
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }

  async function loadState(forceAdvance = false) {
    if (USE_MOCK) return;
    try {
      const data = await api('/api/state');
      setStats(data.stats);
      setNotes(data.notes);
      setDrafts(data.drafts);
      setDueCards(data.dueCards);
      setReviews(data.reviews);
      if (data.dueCards.length > 0) {
        if (forceAdvance || !activeCard) {
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
        topics: target.topics.value.split(',').map((t: string) => t.trim()).filter(Boolean),
      },
      ai: {
        provider: target.provider.value,
        apiKey: target.apiKey.value.trim(),
        baseUrl: target.baseUrl.value.trim(),
        model: target.model.value.trim(),
      },
    };
    if (USE_MOCK) {
      setSettings(body as any);
      triggerStatus('Settings saved.');
      return;
    }
    try {
      await api('/api/settings', { method: 'POST', body });
      triggerStatus('Settings saved.');
      await loadSettings();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleSyncNotion() {
    if (USE_MOCK) {
      triggerStatus('Synced 3 notes.');
      return;
    }
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
    if (USE_MOCK) {
      triggerStatus('Generated 2 drafts from note.');
      setView('drafts');
      return;
    }
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
    if (USE_MOCK) {
      setDrafts((prev) => prev.filter((d: any) => d.id !== id));
      triggerStatus('Draft approved.');
      return;
    }
    try {
      await api(`/api/drafts/${id}/approve`, { method: 'POST', body: {} });
      triggerStatus('Draft approved.');
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleRejectDraft(id: number) {
    if (USE_MOCK) {
      setDrafts((prev) => prev.filter((d: any) => d.id !== id));
      triggerStatus('Draft rejected.');
      return;
    }
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
    if (USE_MOCK) {
      setAiCritique({
        summary:
          'Solid coverage of the main concepts. You clearly understand the fundamental differences. Consider elaborating on specific real-world examples like how Chrome uses multi-process architecture vs how a web server uses threads for handling requests.',
        suggestedRating: 'good',
        missingKeyPoints: ['Real-world architecture examples', 'Thread safety mechanisms (mutex, semaphore)'],
      });
      return;
    }
    try {
      const result = await api(`/api/cards/${activeCard.id}/critique`, {
        method: 'POST',
        body: { answer: userAnswer.trim() },
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
    if (USE_MOCK) {
      setUserAnswer('');
      setShowAnswerKey(false);
      setAiCritique(null);
      const nextCards = dueCards.filter((c: any) => c.id !== activeCard.id);
      if (nextCards.length > 0) {
        setActiveCard(nextCards[0]);
        setActiveStartedAt(Date.now());
      } else {
        setActiveCard(null);
        setActiveStartedAt(null);
      }
      setDueCards(nextCards);
      triggerStatus('Review saved.');
      return;
    }
    try {
      await api(`/api/cards/${activeCard.id}/review`, {
        method: 'POST',
        body: {
          answer: userAnswer.trim(),
          aiFeedback: aiCritique,
          rating,
          elapsedSeconds: Math.round((Date.now() - (activeStartedAt || Date.now())) / 1000),
        },
      });
      setUserAnswer('');
      setShowAnswerKey(false);
      setAiCritique(null);
      setActiveCard(null);
      setActiveStartedAt(null);
      triggerStatus('Review saved.');
      await loadState(true);
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  return (
    <main className="shell">
      <Sidebar view={view} onViewChange={setView} />
      <section className="content">
        <TopBar stats={stats} onRefresh={loadState} />
        {status && <Toast message={status.message} isError={status.isError} />}
        {view === 'practice' && (
          <PracticeView
            activeCard={activeCard}
            userAnswer={userAnswer}
            setUserAnswer={setUserAnswer}
            showAnswerKey={showAnswerKey}
            setShowAnswerKey={setShowAnswerKey}
            aiCritique={aiCritique}
            onCritique={handleRequestCritique}
            onReview={handleSubmitReview}
          />
        )}
        {view === 'drafts' && (
          <DraftsView
            drafts={drafts}
            onApprove={handleApproveDraft}
            onReject={handleRejectDraft}
          />
        )}
        {view === 'notes' && (
          <NotesView
            notes={notes}
            onGenerate={handleGenerateDrafts}
            onSync={handleSyncNotion}
          />
        )}
        {view === 'history' && <HistoryView reviews={reviews} />}
        {view === 'settings' && <SettingsView settings={settings} onSave={handleSaveSettings} />}
      </section>
    </main>
  );
}
