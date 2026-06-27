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
  const [stats, setStats] = useState(USE_MOCK ? mockStats : { dueCount: 0, draftCount: 0, reviewCount: 0, mcqReviewCount: 0 });
  const [notes, setNotes] = useState<any[]>(USE_MOCK ? mockNotes : []);
  const [drafts, setDrafts] = useState<any[]>(USE_MOCK ? mockDrafts : []);
  const [dueCards, setDueCards] = useState<any[]>(USE_MOCK ? mockCards : []);
  const [reviews, setReviews] = useState<any[]>(USE_MOCK ? mockReviews : []);
  const [settings, setSettings] = useState<any>(USE_MOCK ? mockSettings : { notion: {}, ai: { provider: 'offline' } });
  const [mcqCards, setMcqCards] = useState<any[]>([]);
  const [mcqReviews, setMcqReviews] = useState<any[]>([]);
  const [status, setStatus] = useState<{ message: string; isError?: boolean } | null>(null);
  const [activeCard, setActiveCard] = useState<any>(USE_MOCK ? mockCards[0] : null);
  const [activeStartedAt, setActiveStartedAt] = useState<number | null>(USE_MOCK ? Date.now() : null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [aiCritique, setAiCritique] = useState<any>(null);
  const [practiceMode, setPracticeMode] = useState<'open' | 'mcq'>('open');
  const [activeMCQIndex, setActiveMCQIndex] = useState(0);
  const [mcqAnswered, setMcqAnswered] = useState<Record<number, number>>({});
  const [mcqShuffled, setMcqShuffled] = useState<any[]>([]);
  const [cardFilterTag, setCardFilterTag] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

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

  async function loadState(forceAdvance = false): Promise<any> {
    if (USE_MOCK) return;
    try {
      const data = await api('/api/state');
      setStats(data.stats);
      setNotes(data.notes);
      setDrafts(data.drafts);
      setDueCards(data.dueCards);
      setReviews(data.reviews);
      if (data.mcqs) {
        setMcqCards(data.mcqs);
        setMcqShuffled((prev) => prev.length === 0 ? shuffleArray(data.mcqs) : prev);
      }
      if (data.mcqReviews) setMcqReviews(data.mcqReviews);
      if (data.dueCards.length > 0) {
        if (forceAdvance || !activeCard) {
          setActiveCard(data.dueCards[0]);
          setActiveStartedAt(Date.now());
        }
      } else {
        setActiveCard(null);
      }
      return data;
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

  async function handleGenerateMoreMCQs() {
    triggerStatus('Generating more multiple choice questions...');
    try {
      const result = await api('/api/mcqs/generate', { method: 'POST', body: {} });
      triggerStatus(`Generated ${result.mcqs.length} new MCQs.`);
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleGenerateAllDrafts() {
    triggerStatus('Generating drafts from all notes...');
    try {
      const result = await api('/api/notes/generate-all', { method: 'POST', body: {} });
      triggerStatus(`Generated ${result.drafts.length} drafts.`);
      await loadState();
      setView('drafts');
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
      const newData = await loadState(true);
      if (cardFilterTag && newData?.dueCards) {
        const match = newData.dueCards.find((c: any) => c.tags?.includes(cardFilterTag));
        if (match) setActiveCard(match);
      }
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  async function handleMcqAnswer(mcqId: number, optionIdx: number) {
    setMcqAnswered(prev => ({ ...prev, [mcqId]: optionIdx }));
    if (USE_MOCK) return;
    try {
      await api(`/api/mcqs/${mcqId}/review`, { method: 'POST', body: { selectedIndex: optionIdx } });
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }

  function handleMcqIndexChange(idx: number) {
    setActiveMCQIndex(idx);
  }

  function handleCardFilterChange(tag: string | null) {
    setCardFilterTag(tag);
    setUserAnswer('');
    setShowAnswerKey(false);
    setAiCritique(null);
    if (tag) {
      const match = dueCards.find((c: any) => c.tags?.includes(tag));
      if (match) setActiveCard(match);
    } else {
      setActiveCard(dueCards[0] || null);
    }
    setActiveStartedAt(Date.now());
  }

  function handleShuffleMCQs() {
    setMcqShuffled(shuffleArray(mcqShuffled.length > 0 ? mcqShuffled : mcqCards));
    setActiveMCQIndex(0);
    setMcqAnswered({});
  }

  return (
    <main className="shell">
      <Sidebar view={view} onViewChange={setView} />
      <section className="content">
        <TopBar stats={stats} onRefresh={loadState} />
        <div className="main-panel">
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
            practiceMode={practiceMode}
            onPracticeModeChange={setPracticeMode}
            mcqCards={mcqShuffled}
            mcqAnswered={mcqAnswered}
            onMcqAnswer={handleMcqAnswer}
            activeMCQIndex={activeMCQIndex}
            onMcqIndexChange={handleMcqIndexChange}
            onShuffleMCQs={handleShuffleMCQs}
            dueCards={dueCards}
            cardFilterTag={cardFilterTag}
            onCardFilterChange={handleCardFilterChange}
          />
        )}
        {view === 'drafts' && (
          <DraftsView
            drafts={drafts}
            onApprove={handleApproveDraft}
            onReject={handleRejectDraft}
            onGenerateMCQs={handleGenerateMoreMCQs}
          />
        )}
        {view === 'notes' && (
          <NotesView
            notes={notes}
            onGenerate={handleGenerateDrafts}
            onGenerateAll={handleGenerateAllDrafts}
            onSync={handleSyncNotion}
          />
        )}
        {view === 'history' && <HistoryView reviews={reviews} mcqReviews={mcqReviews} />}
        {view === 'settings' && <SettingsView settings={settings} onSave={handleSaveSettings} />}
        </div>
      </section>
    </main>
  );
}
