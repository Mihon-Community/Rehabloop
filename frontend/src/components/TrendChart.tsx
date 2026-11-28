import { useId, useState, type ReactNode } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/app/themeStore';
import {
  EChartsBarChart,
  type ChartConfig,
} from '@/components/evilcharts/charts/echarts-bar-chart';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { SimulatedBadge } from './SimulatedBadge';
import type { DataSource, SessionRecord } from '@/types';
import { Activity, ChartNoAxesCombined, Gauge, TableProperties } from '@/components/icon';
import { Button } from '@/components/base';

// Series colours reference the active theme's own tokens (see src/index.css),
// so every chart matches the active theme — never a fixed hex. Both charts here
// plot a SINGLE series, so both take slot 1: the hue means "the measured
// series", and the two are told apart by title and axis, not by colour. Slot 2
// stays reserved for the one real two-mark comparison (the Recovery Twin).
const qualityChartConfig = {
  quality: { label: 'Usable frames (%)', colors: { light: ['var(--chart-1)'] } },
} satisfies ChartConfig;

interface Props {
  sessions: SessionRecord[];
  source: DataSource;
}

/** Branded tooltip so charts read as part of the design system, not a raw Recharts default. */
function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ value: number | string; color?: string; name?: string }>;
  label?: string;
  formatValue: (value: number | string, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">Session on {label}</p>
      {payload.map((entry, index) => (
        <p className="chart-tooltip-row" key={index}>
          <span
            className="chart-tooltip-dot"
            style={{ background: entry.color }}
            aria-hidden="true"
          />
          {formatValue(entry.value, entry.name)}
        </p>
      ))}
    </div>
  );
}

function ChartCard({
  titleId,
  title,
  icon,
  caption,
  ariaLabel,
  source,
  showTable,
  onToggle,
  children,
  table,
}: {
  titleId: string;
  title: string;
  icon: ReactNode;
  caption: string;
  ariaLabel: string;
  source: DataSource;
  showTable: boolean;
  onToggle: () => void;
  children: ReactNode;
  table: ReactNode;
}) {
  return (
    <section className="card chart-card card-chart-paper" aria-labelledby={titleId}>
      <div className="card-chart-head flex-wrap">
        <span className="icon-chip" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="card-chart-title">
            {title}
          </h2>
          <SimulatedBadge source={source} />
        </div>
        <Button variant="outline" size="sm" onClick={onToggle} aria-expanded={showTable}>
          <TableProperties aria-hidden="true" />
          {showTable ? 'Hide data table' : 'Show data table'}
        </Button>
      </div>
      <figure>
        <figcaption className="meta mb-3">{caption}</figcaption>
        <div className="h-56 w-full" role="group" aria-label={ariaLabel}>
          {children}
        </div>
      </figure>
      {/* The table has four columns of numbers that cannot usefully be
          squeezed below about 30rem, so it scrolls sideways within the card
          rather than widening the page. */}
      {showTable ? <div className="mt-4 overflow-x-auto">{table}</div> : null}
    </section>
  );
}

/** Stored session values only. Two complementary views with table alternatives. */
export function TrendChart({ sessions, source }: Props) {
  const [showRepTable, setShowRepTable] = useState(false);
  const [showQualityTable, setShowQualityTable] = useState(false);
  const reducedMotion = useReducedMotion();
  const { themeId } = useTheme();
  const rawId = useId().replace(/:/g, '');
  const lineTitleId = `reps-title-${rawId}`;
  const barTitleId = `quality-title-${rawId}`;
  const gradientId = `reps-fill-${rawId}`;

  const data = sessions.map((session) => ({
    date: session.started_at.slice(0, 10),
    reps: session.completed_reps ?? null,
    quality: session.usable_frame_pct ?? null,
    status: session.status,
  }));
  const repCount = data.filter((point) => point.reps !== null).length;
  const qualityCount = data.filter((point) => point.quality !== null).length;
  // Index of the most recent reported value — the only point that gets a
  // direct label.
  const lastRepIndex = data.reduce((last, point, i) => (point.reps !== null ? i : last), -1);

  const table = (
    <table className="data-table">
      <caption>Recorded session values (repetitions are counts; quality is a percentage)</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Completed reps (count)</th>
          <th scope="col">Usable frames (%)</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((session) => (
          <tr key={session.id}>
            <td>{session.started_at.slice(0, 10)}</td>
            <td>{session.completed_reps ?? 'not reported'}</td>
            <td>
              {session.usable_frame_pct !== undefined
                ? `${session.usable_frame_pct}%`
                : 'not reported'}
            </td>
            <td>{session.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const axisTick = { fill: 'var(--muted-foreground)', fontSize: 12 };
  const axisLabel = { fill: 'var(--muted-foreground)', fontSize: 12 };

  return (
    <div className="screen-stack">
      <ChartCard
        titleId={lineTitleId}
        title="Completed repetitions over time"
        icon={<ChartNoAxesCombined className="size-5" />}
        caption={`Line chart of completed repetitions from ${repCount} recorded session${repCount === 1 ? '' : 's'}. X axis: session date. Y axis: repetitions (count). Missing values appear as gaps and as “not reported” in the table.`}
        ariaLabel="Line chart of completed repetitions by session date"
        source={source}
        showTable={showRepTable}
        onToggle={() => setShowRepTable((value) => !value)}
        table={table}
      >
        {repCount ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={axisTick}
                tickFormatter={(value: string) => value.slice(5)}
                interval="preserveStartEnd"
                minTickGap={16}
                label={{
                  value: 'Session date',
                  position: 'insideBottom',
                  offset: -4,
                  ...axisLabel,
                }}
              />
              <YAxis
                width={54}
                tick={axisTick}
                label={{ value: 'Reps (count)', angle: -90, position: 'insideLeft', ...axisLabel }}
                allowDecimals={false}
              />
              {/* A hairline crosshair rather than Recharts' default grey band,
                  and no legend: one series needs no legend box — the card
                  title already names it. */}
              <Tooltip
                cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
                content={
                  <ChartTooltip formatValue={(value) => `Completed reps: ${value} repetitions`} />
                }
              />
              <Area
                type="monotone"
                dataKey="reps"
                stroke="none"
                fill={`url(#${gradientId})`}
                connectNulls={false}
                isAnimationActive={!reducedMotion}
                animationDuration={450}
                legendType="none"
              />
              <Line
                type="monotone"
                dataKey="reps"
                name="Completed repetitions (count)"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: 'var(--card)', strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={!reducedMotion}
                animationDuration={450}
              >
                {/* One direct label, on the latest session only. A value beside
                    every point goes unread; the newest number is the one a
                    patient looks for, and the axis plus tooltip carry the rest. */}
                <LabelList
                  dataKey="reps"
                  position="top"
                  offset={10}
                  fontSize={12}
                  fontWeight={700}
                  fill="var(--foreground)"
                  content={(props) => {
                    const { x, y, value, index } = props as {
                      x?: number;
                      y?: number;
                      value?: number | null;
                      index?: number;
                    };
                    if (index !== lastRepIndex || value == null || x == null || y == null) {
                      return null;
                    }
                    return (
                      <text
                        x={x}
                        y={y - 10}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight={700}
                        fill="var(--foreground)"
                      >
                        {value}
                      </text>
                    );
                  }}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-empty" role="status">
            No chart data is available yet.
          </div>
        )}
      </ChartCard>

      <ChartCard
        titleId={barTitleId}
        title="Measurement quality by session"
        icon={<Gauge className="size-5" />}
        caption={`Bar chart of usable frames from ${qualityCount} recorded session${qualityCount === 1 ? '' : 's'}. X axis: session date. Y axis: usable frames (%). Missing values appear as “not reported” in the table.`}
        ariaLabel="Bar chart of usable frame percentage by session date"
        source={source}
        showTable={showQualityTable}
        onToggle={() => setShowQualityTable((value) => !value)}
        table={table}
      >
        {qualityCount ? (
          <EChartsBarChart
            key={themeId}
            data={data}
            config={qualityChartConfig}
            xDataKey="date"
            className="h-full w-full"
            barRadius={4}
          >
            <EChartsBarChart.XAxis
              dataKey="date"
              tickFormatter={(value) => value.slice(5)}
              label="Session date"
            />
            <EChartsBarChart.YAxis
              tickFormatter={(value) => `${value}%`}
              label="Usable frames (%)"
            />
            <EChartsBarChart.Grid />
            <EChartsBarChart.Tooltip />
            <EChartsBarChart.Bar dataKey="quality" />
          </EChartsBarChart>
        ) : (
          <div className="chart-empty" role="status">
            No quality data is available yet.
          </div>
        )}
      </ChartCard>

      <p className="meta flex items-center gap-2">
        <Activity className="size-4" aria-hidden="true" />
        Both charts use stored session values only. Angles and quality are estimates from one camera
        view; no clinical conclusion is drawn from them.
      </p>
    </div>
  );
}
