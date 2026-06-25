'use client';

interface MetricCardProps {
  value: number;
  label: string;
}

export default function MetricCard({ value, label }: MetricCardProps) {
  return (
    <div className="metric">
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}
