'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { USE_MOCK } from '@/lib/mock-data';

export type ViewType = 'practice' | 'drafts' | 'notes' | 'history' | 'settings';


function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function useAppState() {
  const api = getApiClient();

  const [view, setView] = useState<ViewType>('practice');
  const [stats, setStats] = useState<any>({ dueCount: 0, draftCount: 0, reviewCount: 0, mcqReviewCount: 0 });
  const [notes, setNotes] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [dueCards, setDueCards] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ notion: {}, ai: { provider: 'offline' } });
  const [mcqCards, setMcqCards] = useState<any[]>([]);
  const [mcqReviews, setMcqReviews] = useState<any[]>([]);
  const [status, setStatus] = useState<{ message: string; isError?: boolean } | null>(null);
  const [activeCard, setActiveCard] = useState<any>(null);
  const [activeStartedAt, setActiveStartedAt] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [aiCritique, setAiCritique] = useState<any>(null);
  const [practiceMode, setPracticeMode] = useState<'open' | 'mcq'>('open');
  const [activeMCQIndex, setActiveMCQIndex] = useState(0);
  const [mcqAnswered, setMcqAnswered] = useState<Record<number, number>>({});
  const [mcqShuffled, setMcqShuffled] = useState<any[]>([]);
  const [cardFilterTag, setCardFilterTag] = useState<string | null>(null);

  const triggerStatus = useCallback((msg: string, isErr = false) => {
    setStatus({ message: msg, isError: isErr });
    setTimeout(() => setStatus(null), 5000);
  }, []);

  const loadSettings = useCallback(async () => {
    if (USE_MOCK) return;
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }, [api, triggerStatus]);

  const loadState = useCallback(async (forceAdvance = false): Promise<any> => {
    if (USE_MOCK) {
      const data = await api.getState();
      setStats(data.stats);
      setDrafts(data.drafts);
      setDueCards(data.dueCards);
      setReviews(data.reviews);
      return data;
    }
    try {
      const data = await api.getState();
      setStats(data.stats);
      setNotes(data.notes);
      setDrafts(data.drafts);
      setDueCards(data.dueCards);
      setReviews(data.reviews);
      if (data.mcqs) {
        setMcqCards(data.mcqs);
        setMcqShuffled((prev) => (prev.length === 0 ? shuffleArray(data.mcqs) : prev));
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
  }, [api, triggerStatus, activeCard]);

  useEffect(() => {
    if (USE_MOCK) return;
    (async () => {
      try {
        const data = await api.getSettings();
        setSettings(data);
        const state = await api.getState();
        setStats(state.stats);
        setNotes(state.notes);
        setDrafts(state.drafts);
        setDueCards(state.dueCards);
        setReviews(state.reviews);
        if (state.mcqs) {
          setMcqCards(state.mcqs);
          setMcqShuffled(shuffleArray(state.mcqs));
        }
        if (state.mcqReviews) setMcqReviews(state.mcqReviews);
        if (state.dueCards.length > 0) {
          setActiveCard(state.dueCards[0]);
          setActiveStartedAt(Date.now());
        }
      } catch (e: any) {
        triggerStatus(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveSettings = useCallback(async (e: React.FormEvent) => {
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
    try {
      await api.saveSettings(body);
      triggerStatus('Settings saved.');
      await loadSettings();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }, [api, triggerStatus, loadSettings]);

  const handleSyncNotion = useCallback(async () => {
    triggerStatus('Syncing Notion...');
    try {
      const result = await api.syncNotion();
      triggerStatus(`Synced ${result.imported} notes.`);
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }, [api, triggerStatus, loadState]);

  const handleGenerateAllDrafts = useCallback(async () => {
    triggerStatus('Generating drafts from all notes...');
    try {
      const result = await api.generateAllNotes();
      triggerStatus(`Generated ${result.drafts.length} drafts.`);
      await loadState();
      setView('drafts');
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }, [api, triggerStatus, loadState]);

  const handleGenerateDrafts = useCallback(async (noteId: number) => {
    triggerStatus('Generating drafts...');
    try {
      const result = await api.generateFromNote(noteId);
      triggerStatus(`Generated ${result.drafts.length} drafts.`);
      await loadState();
      setView('drafts');
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }, [api, triggerStatus, loadState]);

  const handleGenerateMoreMCQs = useCallback(async () => {
    triggerStatus('Generating more multiple choice questions...');
    try {
      const result = await api.generateMCQs();
      triggerStatus(`Generated ${result.mcqs.length} new MCQs.`);
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }, [api, triggerStatus, loadState]);

  const handleApproveDraft = useCallback(async (id: number) => {
    try {
      await api.approveDraft(id);
      triggerStatus('Draft approved.');
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }, [api, triggerStatus, loadState]);

  const handleRejectDraft = useCallback(async (id: number) => {
    try {
      await api.rejectDraft(id);
      triggerStatus('Draft rejected.');
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }, [api, triggerStatus, loadState]);

  const handleRequestCritique = useCallback(async () => {
    if (!userAnswer.trim()) {
      triggerStatus('Write an answer before requesting critique.', true);
      return;
    }
    try {
      const result = await api.critiqueAnswer(activeCard.id, userAnswer.trim());
      setAiCritique(result.critique);
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }, [api, triggerStatus, activeCard, userAnswer]);

  const handleSubmitReview = useCallback(async (rating: string) => {
    if (!userAnswer.trim()) {
      triggerStatus('Write an answer before grading the card.', true);
      return;
    }
    try {
      await api.submitReview(activeCard.id, {
        answer: userAnswer.trim(),
        aiFeedback: aiCritique,
        rating,
        elapsedSeconds: Math.round((Date.now() - (activeStartedAt || Date.now())) / 1000),
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
  }, [api, triggerStatus, activeCard, userAnswer, aiCritique, activeStartedAt, cardFilterTag, loadState]);

  const handleMcqAnswer = useCallback(async (mcqId: number, optionIdx: number) => {
    setMcqAnswered((prev) => ({ ...prev, [mcqId]: optionIdx }));
    try {
      await api.recordMCQAnswer(mcqId, optionIdx);
      await loadState();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }, [api, triggerStatus, loadState]);

  const handleMcqIndexChange = useCallback((idx: number) => {
    setActiveMCQIndex(idx);
  }, []);

  const handleCardFilterChange = useCallback((tag: string | null) => {
    setCardFilterTag(tag);
    setUserAnswer('');
    setShowAnswerKey(false);
    setAiCritique(null);
    setActiveCard(tag ? dueCards.find((c: any) => c.tags?.includes(tag)) || null : dueCards[0] || null);
    setActiveStartedAt(Date.now());
  }, [dueCards]);

  const handleShuffleMCQs = useCallback(() => {
    setMcqShuffled(shuffleArray(mcqShuffled.length > 0 ? mcqShuffled : mcqCards));
    setActiveMCQIndex(0);
    setMcqAnswered({});
  }, [mcqShuffled, mcqCards]);

  return {
    view, setView,
    stats, notes, drafts, dueCards, reviews, settings,
    mcqCards, mcqReviews, status, activeCard, activeStartedAt,
    userAnswer, setUserAnswer, showAnswerKey, setShowAnswerKey,
    aiCritique, practiceMode, setPracticeMode,
    activeMCQIndex, mcqAnswered, mcqShuffled, cardFilterTag,
    handleSaveSettings, handleSyncNotion,
    handleGenerateDrafts, handleGenerateAllDrafts, handleGenerateMoreMCQs,
    handleApproveDraft, handleRejectDraft,
    handleRequestCritique, handleSubmitReview,
    handleMcqAnswer, handleMcqIndexChange, handleCardFilterChange, handleShuffleMCQs,
    loadState,
  };
}
