import type { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Trend {
  direction: 'up' | 'down' | 'flat';
  label: string;
}

export function MetricCard({
  label,
  value,
  unit,
  hint,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  icon?: ReactNode;
  trend?: Trend;
}) {
  const trendIcon =
    trend?.direction === 'up' ? (
      <TrendingUp className="size-3.5" aria-hidden="true" />
    ) : trend?.direction === 'down' ? (
      <TrendingDown className="size-3.5" aria-hidden="true" />
    ) : (
      <Minus className="size-3.5" aria-hidden="true" />
    );

  return (
    <Card className="metric-card gap-1 p-4">
      <div className="metric-card-head">
        <span className="metric-label">{label}</span>
        {icon ? <span className="icon-chip">{icon}</span> : null}
      </div>
      <span className="metric-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      {trend ? (
        <span className={`metric-trend metric-trend-${trend.direction}`}>
          {trendIcon}
          {trend.label}
        </span>
      ) : null}
      {hint ? <span className="meta">{hint}</span> : null}
    </Card>
  );
}
