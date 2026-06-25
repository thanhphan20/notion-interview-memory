'use client';

type ViewType = 'practice' | 'drafts' | 'notes' | 'history' | 'settings';

interface SidebarProps {
  view: ViewType;
  onViewChange: (v: ViewType) => void;
}

const NAV_ITEMS: { key: ViewType; label: string }[] = [
  { key: 'practice', label: 'Practice' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'notes', label: 'Notes' },
  { key: 'history', label: 'History' },
  { key: 'settings', label: 'Settings' },
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
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
