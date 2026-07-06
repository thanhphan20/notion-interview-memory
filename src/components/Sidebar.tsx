'use client';

import {
  IconPractice, IconDrafts, IconNotes, IconHistory, IconSettings, IconMC,
} from './ui/Icons';

type ViewType = 'dashboard' | 'practice' | 'sprint' | 'diagnostic' | 'mcqPractice' | 'drafts' | 'notes' | 'history' | 'settings';

interface SidebarProps {
  view: ViewType;
  onViewChange: (v: ViewType) => void;
}

const NAV_ITEMS: { key: ViewType; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <IconHistory /> },
  { key: 'practice', label: 'Practice', icon: <IconPractice /> },
  { key: 'diagnostic', label: 'Diagnostic', icon: <IconDrafts /> },
  { key: 'mcqPractice', label: 'MCQ Practice', icon: <IconMC /> },
  { key: 'sprint', label: 'Sprint', icon: <IconPractice /> },
  { key: 'drafts', label: 'Drafts', icon: <IconDrafts /> },
  { key: 'notes', label: 'Notes', icon: <IconNotes /> },
  { key: 'history', label: 'History', icon: <IconHistory /> },
  { key: 'settings', label: 'Settings', icon: <IconSettings /> },
];

export default function Sidebar({ view, onViewChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>Interview Memory</h1>
        <p className="muted">Notion-powered spaced interview practice</p>
      </div>
      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onViewChange(item.key)}
            className={view === item.key ? 'active' : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
