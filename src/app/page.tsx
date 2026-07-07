'use client';

import { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import Toast from '@/components/ui/Toast';
import OpenRecallView from '@/components/OpenRecallView';
import MCQPracticeView from '@/components/MCQPracticeView';
import McqTopicPracticeView from '@/components/McqTopicPracticeView';
import SprintView from '@/components/SprintView';
import DraftsView from '@/components/DraftsView';
import NotesView from '@/components/NotesView';
import HistoryView from '@/components/HistoryView';
import SettingsView from '@/components/SettingsView';
import DashboardView from '@/components/DashboardView';
import { useAppState, ViewType } from '@/hooks/useAppState';

export default function SPA() {
  const {
    view, setView, stats, notes, drafts, dueCards, reviews, settings,
    mcqs, mcqReviews, status, activeCard,
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
    loadState,
  } = useAppState();

  const views: Record<ViewType, ReactNode> = {
    dashboard: (
      <DashboardView
        dashboard={dashboard}
        onSetInterviewDate={handleSetInterviewDate}
        onTagClick={handleTagClick}
        onDrillLapses={handleDrillLapses}
        onStartSprint={handleStartSprint}
        onStartDiagnostic={handleStartDiagnostic}
      />
    ),
    practice: (
      <section className="view view-enter">
        <div className="section-heading">
          <div>
            <h2>Interview Practice</h2>
            <p className="muted">Answer due cards, get optional AI critique, self-grade. Full FSRS scheduling.</p>
          </div>
        </div>
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
      </section>
    ),
    sprint: (
      <SprintView
        session={sprintSession}
        result={sprintResult}
        onStart={handleStartSprint}
        onComplete={handleCompleteSprint}
        onExit={handleExitSprint}
      />
    ),
    diagnostic: (
      <MCQPracticeView
        session={diagnosticSession}
        result={diagnosticResult}
        allMcqs={mcqs}
        onStart={handleStartDiagnostic}
        onComplete={handleCompleteDiagnostic}
        onDrillTags={handleDrillTags}
        onExit={handleExitDiagnostic}
      />
    ),
    mcqPractice: (
      <McqTopicPracticeView
        allMcqs={mcqs}
        session={mcqPracticeSession}
        result={mcqPracticeResult}
        onStart={handleStartMcqPractice}
        onComplete={handleCompleteMcqPractice}
        onChangeTopic={handleChangeMcqPracticeTopic}
        onExit={handleExitMcqPractice}
      />
    ),
    drafts: (
      <DraftsView
        drafts={drafts}
        notes={notes}
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
    settings: (
      <SettingsView
        settings={settings}
        onSave={handleSaveSettings}
        onPingProviders={handlePingProviders}
        providerCheckResults={providerCheckResults}
        providerCheckPending={providerCheckPending}
      />
    ),
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
