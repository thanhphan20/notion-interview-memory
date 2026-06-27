'use client';

import { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import Toast from '@/components/ui/Toast';
import OpenRecallView from '@/components/OpenRecallView';
import MCQPracticeView from '@/components/MCQPracticeView';
import DraftsView from '@/components/DraftsView';
import NotesView from '@/components/NotesView';
import HistoryView from '@/components/HistoryView';
import SettingsView from '@/components/SettingsView';
import { IconCritique, IconMC } from '@/components/ui/Icons';
import { useAppState, ViewType } from '@/hooks/useAppState';

export default function SPA() {
  const {
    view, setView, stats, notes, drafts, dueCards, reviews, settings,
    mcqReviews, status, activeCard,
    userAnswer, setUserAnswer, showAnswerKey, setShowAnswerKey,
    aiCritique, practiceMode, setPracticeMode,
    activeMCQIndex, mcqAnswered, mcqShuffled, cardFilterTag,
    handleSaveSettings, handleSyncNotion,
    handleGenerateDrafts, handleGenerateAllDrafts, handleGenerateMoreMCQs,
    handleApproveDraft, handleRejectDraft,
    handleRequestCritique, handleSubmitReview,
    handleMcqAnswer, handleMcqIndexChange, handleCardFilterChange, handleShuffleMCQs,
    loadState,
  } = useAppState();

  const views: Record<ViewType, ReactNode> = {
    practice: (
      <section className="view view-enter">
        <div className="section-heading">
          <div>
            <h2>Interview Practice</h2>
            <p className="muted">Answer due cards aloud or in writing, then self-grade.</p>
          </div>
        </div>
        <div className="practice-tabs">
          <button
            className={`practice-tab ${practiceMode === 'open' ? 'active' : ''}`}
            onClick={() => setPracticeMode('open')}
          >
            <IconCritique />
            Open Recall
          </button>
          <button
            className={`practice-tab ${practiceMode === 'mcq' ? 'active' : ''}`}
            onClick={() => setPracticeMode('mcq')}
          >
            <IconMC />
            Multiple Choice
          </button>
        </div>
        {practiceMode === 'open' ? (
          <OpenRecallView
            activeCard={activeCard}
            userAnswer={userAnswer}
            setUserAnswer={setUserAnswer}
            showAnswerKey={showAnswerKey}
            setShowAnswerKey={setShowAnswerKey}
            aiCritique={aiCritique}
            onCritique={handleRequestCritique}
            onReview={handleSubmitReview}
            dueCards={dueCards}
            cardFilterTag={cardFilterTag}
            onCardFilterChange={handleCardFilterChange}
          />
        ) : (
          <MCQPracticeView
            mcqs={mcqShuffled}
            mcqAnswered={mcqAnswered}
            onMcqAnswer={handleMcqAnswer}
            activeMCQIndex={activeMCQIndex}
            onMcqIndexChange={handleMcqIndexChange}
            onShuffleMCQs={handleShuffleMCQs}
          />
        )}
      </section>
    ),
    drafts: (
      <DraftsView
        drafts={drafts}
        onApprove={handleApproveDraft}
        onReject={handleRejectDraft}
        onGenerateMCQs={handleGenerateMoreMCQs}
      />
    ),
    notes: (
      <NotesView
        notes={notes}
        onGenerate={handleGenerateDrafts}
        onGenerateAll={handleGenerateAllDrafts}
        onSync={handleSyncNotion}
      />
    ),
    history: <HistoryView reviews={reviews} mcqReviews={mcqReviews} />,
    settings: <SettingsView settings={settings} onSave={handleSaveSettings} />,
  };

  return (
    <main className="shell">
      <Sidebar view={view} onViewChange={setView} />
      <section className="content">
        <TopBar stats={stats} onRefresh={() => loadState()} />
        <div className="main-panel">
          {status && <Toast message={status.message} isError={status.isError} />}
          {views[view]}
        </div>
      </section>
    </main>
  );
}
