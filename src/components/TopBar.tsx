'use client';

import MetricCard from './ui/MetricCard';
import Button from './ui/Button';
import { IconRefresh } from './ui/Icons';

interface TopBarProps {
  stats: { dueCount: number; draftCount: number; reviewCount: number };
  onRefresh: () => void;
}

export default function TopBar({ stats, onRefresh }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-stats">
        <MetricCard value={stats.dueCount} label="Due" />
        <MetricCard value={stats.draftCount} label="Drafts" />
        <MetricCard value={stats.reviewCount} label="Reviews" />
      </div>
      <Button variant="secondary" onClick={onRefresh}>
        <IconRefresh />
        Refresh
      </Button>
    </header>
  );
}
