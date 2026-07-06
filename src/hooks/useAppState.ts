'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { USE_MOCK } from '@/lib/mock-data';

export type ViewType = 'dashboard' | 'practice' | 'sprint' | 'diagnostic' | 'mcqPractice' | 'drafts' | 'notes' | 'history' | 'settings';

function readProviderConfigFromForm(data: FormData, prefix: string) {
  return {
    provider: String(data.get(`${prefix}.provider`) || 'offline'),
    apiKey: String(data.get(`${prefix}.apiKey`) || '').trim(),
    baseUrl: String(data.get(`${prefix}.baseUrl`) || '').trim(),
    model: String(data.get(`${prefix}.model`) || '').trim(),
  };
}

function readAiConfigFromForm(data: FormData) {
  const fallbackIds = String(data.get('fallbackIds') || '').split(',').map((id) => id.trim()).filter(Boolean);
  const maxInputTokensRaw = String(data.get('maxInputTokens') || '').trim();
  return {
    ...readProviderConfigFromForm(data, 'ai'),
    compressInput: data.get('compressInput') === 'on',
    maxInputTokens: maxInputTokensRaw ? Number(maxInputTokensRaw) : undefined,
    fallbacks: fallbackIds.map((id) => readProviderConfigFromForm(data, id)),
  };
}

export function useAppState() {
  const api = getApiClient();

  const [view, setView] = useState<ViewType>('dashboard');
  const [dashboard, setDashboard] = useState<any>(null);
  const [sprintSession, setSprintSession] = useState<any>(null);
  const [sprintResult, setSprintResult] = useState<any>(null);
  const [diagnosticSession, setDiagnosticSession] = useState<any>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [stats, setStats] = useState<any>({ dueCount: 0, draftCount: 0, reviewCount: 0, mcqReviewCount: 0 });
  const [notes, setNotes] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [dueCards, setDueCards] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ notion: {}, ai: { provider: 'offline' } });
  const [mcqs, setMcqs] = useState<any[]>([]);
  const [mcqReviews, setMcqReviews] = useState<any[]>([]);
  const [mcqPracticeSession, setMcqPracticeSession] = useState<{ tag: string; mcqs: any[] } | null>(null);
  const [mcqPracticeResult, setMcqPracticeResult] = useState<{ tag: string; correct: number; total: number } | null>(null);
  const [status, setStatus] = useState<{ message: string; isError?: boolean } | null>(null);
  const [activeCard, setActiveCard] = useState<any>(null);
  const [activeStartedAt, setActiveStartedAt] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [aiCritique, setAiCritique] = useState<any>(null);
  const [cardFilterTag, setCardFilterTag] = useState<string | null>(null);
  const [providerCheckResults, setProviderCheckResults] = useState<any[] | null>(null);
  const [providerCheckPending, setProviderCheckPending] = useState(false);

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
      if (data.mcqs) setMcqs(data.mcqs);
      return data;
    }
    try {
      const data = await api.getState();
      setStats(data.stats);
      setNotes(data.notes);
      setDrafts(data.drafts);
      setDueCards(data.dueCards);
      setReviews(data.reviews);
      if (data.mcqs) setMcqs(data.mcqs);
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
        if (state.mcqs) setMcqs(state.mcqs);
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

  const handleSaveSettings = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);

    const body = {
      notion: {
        token: String(data.get('token') || '').trim(),
        databaseId: String(data.get('databaseId') || '').trim(),
        titleProperty: String(data.get('titleProperty') || '').trim() || 'Name',
        topicProperty: String(data.get('topicProperty') || '').trim() || 'Topic',
        topics: String(data.get('topics') || '').split(',').map((t) => t.trim()).filter(Boolean),
      },
      ai: readAiConfigFromForm(data),
    };
    try {
      await api.saveSettings(body);
      triggerStatus('Settings saved.');
      await loadSettings();
    } catch (err: any) {
      triggerStatus(err.message, true);
    }
  }, [api, triggerStatus, loadSettings]);

  const handlePingProviders = useCallback(async (form: HTMLFormElement) => {
    const aiConfig = readAiConfigFromForm(new FormData(form));
    setProviderCheckResults(null);
    setProviderCheckPending(true);
    try {
      const results = await api.pingAiProviders(aiConfig);
      setProviderCheckResults(results);
      const failed = results.filter((r: any) => !r.ok);
      triggerStatus(
        failed.length === 0
          ? `All ${results.length} AI provider(s) responded.`
          : `${failed.length}/${results.length} AI provider(s) failed — see details below.`,
        failed.length > 0
      );
    } catch (e: any) {
      triggerStatus(e.message, true);
    } finally {
      setProviderCheckPending(false);
    }
  }, [api, triggerStatus]);

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

  const handleCardFilterChange = useCallback((tag: string | null) => {
    setCardFilterTag(tag);
    setUserAnswer('');
    setShowAnswerKey(false);
    setAiCritique(null);
    setActiveCard(tag ? dueCards.find((c: any) => c.tags?.includes(tag)) || null : dueCards[0] || null);
    setActiveStartedAt(Date.now());
  }, [dueCards]);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setDashboard(data);
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }, [api, triggerStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetInterviewDate = useCallback(async (date: string | null) => {
    try {
      await api.setInterviewDate(date);
      triggerStatus(date ? `Interview date set to ${date}.` : 'Interview date cleared.');
      await loadDashboard();
      await loadState();
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }, [api, triggerStatus, loadDashboard, loadState]);

  const handleTagClick = useCallback((tag: string) => {
    setCardFilterTag(tag);
    setView('practice');
  }, []);

  const handleStartSprint = useCallback(async () => {
    setSprintResult(null);
    setView('sprint');
    try {
      const data = await api.startSprint();
      setSprintSession({ sprintId: data.sprint.id, cards: data.cards, mcqs: data.mcqs });
    } catch (e: any) {
      triggerStatus(e.message, true);
      setView('dashboard');
    }
  }, [api, triggerStatus]);

  const handleCompleteSprint = useCallback(async (payload: { ratings: any[]; mcqAnswers: any[] }) => {
    if (!sprintSession) return;
    try {
      const data = await api.completeSprint(sprintSession.sprintId, payload);
      setSprintResult({ score: data.score, tagBreakdown: data.tagBreakdown });
      setSprintSession(null);
      await Promise.all([loadDashboard(), loadState(true)]);
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }, [api, sprintSession, triggerStatus, loadDashboard, loadState]);

  const handleExitSprint = useCallback(() => {
    setSprintSession(null);
    setSprintResult(null);
    setView('dashboard');
  }, []);

  const handleStartDiagnostic = useCallback(async (tag?: string) => {
    setDiagnosticResult(null);
    setView('diagnostic');
    try {
      const data = await api.startMCQDiagnostic(tag);
      setDiagnosticSession({ diagnosticId: data.diagnostic.id, mcqs: data.mcqs, tag: data.tag ?? null });
    } catch (e: any) {
      triggerStatus(e.message, true);
      setView('dashboard');
    }
  }, [api, triggerStatus]);

  const handleCompleteDiagnostic = useCallback(async (payload: { answers: any[] }) => {
    if (!diagnosticSession) return;
    try {
      const data = await api.completeMCQDiagnostic(diagnosticSession.diagnosticId, payload);
      setDiagnosticResult({ score: data.score, weaknessReport: data.weaknessReport });
      await Promise.all([loadDashboard(), loadState(true)]);
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }, [api, diagnosticSession, triggerStatus, loadDashboard, loadState]);

  const handleExitDiagnostic = useCallback(() => {
    setDiagnosticSession(null);
    setDiagnosticResult(null);
    setView('dashboard');
  }, []);

  const handleDrillTags = useCallback((tags: string[]) => {
    setDiagnosticSession(null);
    setDiagnosticResult(null);
    setCardFilterTag(tags[0] ?? null);
    setView('practice');
  }, []);

  const handleStartMcqPractice = useCallback((tag: string) => {
    const pool = mcqs.filter((m: any) => m.tags?.includes(tag));
    if (pool.length === 0) {
      triggerStatus(`No MCQs tagged "${tag}" yet.`, true);
      return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setMcqPracticeResult(null);
    setMcqPracticeSession({ tag, mcqs: shuffled });
  }, [mcqs, triggerStatus]);

  const handleCompleteMcqPractice = useCallback(async (payload: { answers: { mcqId: number; selectedIndex: number }[] }) => {
    if (!mcqPracticeSession) return;
    try {
      const results = await Promise.all(
        payload.answers.map((a) => api.recordMCQAnswer(a.mcqId, a.selectedIndex))
      );
      const correct = results.filter((r: any) => r.review?.correct).length;
      setMcqPracticeResult({ tag: mcqPracticeSession.tag, correct, total: payload.answers.length });
      await Promise.all([loadDashboard(), loadState(true)]);
    } catch (e: any) {
      triggerStatus(e.message, true);
    }
  }, [api, mcqPracticeSession, triggerStatus, loadDashboard, loadState]);

  const handleChangeMcqPracticeTopic = useCallback(() => {
    setMcqPracticeSession(null);
    setMcqPracticeResult(null);
  }, []);

  const handleExitMcqPractice = useCallback(() => {
    setMcqPracticeSession(null);
    setMcqPracticeResult(null);
    setView('dashboard');
  }, []);

  const handleDrillLapses = useCallback(() => {
    if (!dashboard?.lapses?.length) return;
    const firstLapseCardId = dashboard.lapses[0].cardId;
    const match = dueCards.find((c: any) => c.id === firstLapseCardId);
    if (match) {
      setActiveCard(match);
      setActiveStartedAt(Date.now());
    }
    setView('practice');
  }, [dashboard, dueCards]);

  return {
    view, setView,
    stats, notes, drafts, dueCards, reviews, settings,
    mcqs, mcqReviews, status, activeCard, activeStartedAt,
    userAnswer, setUserAnswer, showAnswerKey, setShowAnswerKey,
    aiCritique,
    cardFilterTag,
    providerCheckResults, providerCheckPending,
    dashboard,
    sprintSession, sprintResult,
    diagnosticSession, diagnosticResult,
    mcqPracticeSession, mcqPracticeResult,
    handleSaveSettings, handlePingProviders, handleSyncNotion,
    handleGenerateDrafts, handleGenerateAllDrafts, handleGenerateMoreMCQs,
    handleApproveDraft, handleRejectDraft,
    handleRequestCritique, handleSubmitReview,
    handleCardFilterChange,
    handleSetInterviewDate, handleTagClick, handleDrillLapses,
    handleStartSprint, handleCompleteSprint, handleExitSprint,
    handleStartDiagnostic, handleCompleteDiagnostic, handleExitDiagnostic, handleDrillTags,
    handleStartMcqPractice, handleCompleteMcqPractice, handleChangeMcqPracticeTopic, handleExitMcqPractice,
    loadState, loadDashboard,
  };
}
