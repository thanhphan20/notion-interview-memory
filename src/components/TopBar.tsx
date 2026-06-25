'use client';

import MetricCard from './ui/MetricCard';
import Button from './ui/Button';

interface TopBarProps {
  stats: { dueCount: number; draftCount: number; reviewCount: number };
  onRefresh: () => void;
}

export default function TopBar({ stats, onRefresh }: TopBarProps) {
  return (
    <header className="topbar">
      <MetricCard value={stats.dueCount} label="Due" />
      <MetricCard value={stats.draftCount} label="Drafts" />
      <MetricCard value={stats.reviewCount} label="Reviews" />
      <Button variant="secondary" onClick={onRefresh}>
        Refresh
      </Button>
    </header>
  );
}
