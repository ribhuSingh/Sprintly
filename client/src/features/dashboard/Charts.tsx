import { useMemo, useState, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Table2 } from 'lucide-react';
import { PRIORITY_LABELS, STATUS_LABELS, type AnalyticsDTO } from '@sprintly/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/misc';
import { useTheme } from '@/hooks/useTheme';

/**
 * Chart colours come from CSS custom properties (validated light & dark steps in index.css),
 * resolved at runtime so a theme toggle repaints the SVG.
 */
function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    return {
      s1: v('--series-1'),
      s2: v('--series-2'),
      grid: v('--border'),
      text: v('--muted-foreground'),
      surface: v('--card'),
      cursor: v('--muted'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

type Colors = ReturnType<typeof useChartColors>;

function ChartCard({ title, description, table, children }: { title: string; description: string; table: ReactNode; children: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          onClick={() => setShowTable((s) => !s)}
          aria-pressed={showTable}
          className="-mr-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <Table2 className="size-3.5" /> {showTable ? 'Chart' : 'Table'}
        </button>
      </CardHeader>
      <CardContent>
        {showTable ? <div className="h-64 overflow-auto">{table}</div> : <div className="h-64" aria-hidden>{children}</div>}
        {/* Screen readers always get the table, even when the chart is shown. */}
        {!showTable && <div className="sr-only">{table}</div>}
      </CardContent>
    </Card>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          {head.map((h, i) => <th key={h} scope="col" className={i ? 'py-1.5 text-right font-medium' : 'py-1.5 font-medium'}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r[0])} className="border-b last:border-0">
            {r.map((c, i) => <td key={i} className={i ? 'py-1.5 text-right tabular-nums' : 'py-1.5'}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartTooltip({ active, payload, label, labelFormatter }: TooltipProps<number, string> & { labelFormatter?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{labelFormatter ? labelFormatter(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey as string} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
          {p.name}: <span className="font-medium tabular-nums text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

const axisProps = (c: Colors) => ({
  stroke: c.grid,
  tick: { fill: c.text, fontSize: 12 },
  tickLine: false,
  axisLine: false,
});

export default function Charts({ data }: { data: AnalyticsDTO }) {
  const c = useChartColors();

  const status = data.byStatus.map((s) => ({ name: STATUS_LABELS[s.status], count: s.count }));
  const priority = [...data.byPriority].reverse().map((p) => ({ name: PRIORITY_LABELS[p.priority], count: p.count }));
  const throughput = data.throughput.map((t) => ({ ...t, label: format(parseISO(t.week), 'MMM d') }));
  const workload = data.workload.map((w) => ({ name: w.user.name.split(' ')[0], full: w.user.name, open: w.open, completed: w.completed }));
  const lastWeek = throughput.at(-1);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Single series → no legend; the title names it. */}
      <ChartCard
        title="Issues by status"
        description="All issues in scope"
        table={<DataTable head={['Status', 'Issues']} rows={status.map((s) => [s.name, s.count])} />}
      >
        <ResponsiveContainer>
          <BarChart data={status} layout="vertical" margin={{ left: 8, right: 32 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke={c.grid} strokeDasharray="0" />
            <XAxis type="number" {...axisProps(c)} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={84} {...axisProps(c)} />
            <Tooltip cursor={{ fill: c.cursor }} content={<ChartTooltip />} />
            <Bar dataKey="count" name="Issues" fill={c.s1} radius={[0, 4, 4, 0]} maxBarSize={22}>
              <LabelList dataKey="count" position="right" fill={c.text} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Open issues by priority"
        description="Excludes completed work"
        table={<DataTable head={['Priority', 'Open']} rows={priority.map((p) => [p.name, p.count])} />}
      >
        <ResponsiveContainer>
          <BarChart data={priority} margin={{ top: 16, right: 8 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="name" {...axisProps(c)} />
            <YAxis {...axisProps(c)} allowDecimals={false} width={32} />
            <Tooltip cursor={{ fill: c.cursor }} content={<ChartTooltip />} />
            <Bar dataKey="count" name="Open issues" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={40}>
              <LabelList dataKey="count" position="top" fill={c.text} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Weekly throughput"
        description={lastWeek ? `This week: ${lastWeek.created} created, ${lastWeek.completed} completed` : 'Last 8 weeks'}
        table={<DataTable head={['Week of', 'Created', 'Completed']} rows={throughput.map((t) => [t.label, t.created, t.completed])} />}
      >
        <ResponsiveContainer>
          <LineChart data={throughput} margin={{ top: 8, right: 24, left: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="label" {...axisProps(c)} />
            <YAxis {...axisProps(c)} allowDecimals={false} width={32} />
            <Tooltip cursor={{ stroke: c.text, strokeWidth: 1, strokeDasharray: '3 3' }} content={<ChartTooltip labelFormatter={(l) => `Week of ${l}`} />} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: c.text }} />
            <Line type="monotone" dataKey="created" name="Created" stroke={c.s1} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
            <Line type="monotone" dataKey="completed" name="Completed" stroke={c.s2} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Workload by assignee"
        description="Open vs completed issues per person"
        table={<DataTable head={['Assignee', 'Open', 'Completed']} rows={workload.map((w) => [w.full, w.open, w.completed])} />}
      >
        {workload.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No assigned issues yet</p>
        ) : (
          <ResponsiveContainer>
            <BarChart data={workload} layout="vertical" margin={{ left: 8, right: 28 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid horizontal={false} stroke={c.grid} />
              <XAxis type="number" {...axisProps(c)} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={64} {...axisProps(c)} />
              <Tooltip cursor={{ fill: c.cursor }} content={<ChartTooltip labelFormatter={(l) => workload.find((w) => w.name === l)?.full ?? l} />} />
              <Legend wrapperStyle={{ fontSize: 12, color: c.text }} iconType="circle" iconSize={8} />
              <Bar dataKey="open" name="Open" fill={c.s1} radius={[0, 4, 4, 0]} maxBarSize={12} />
              <Bar dataKey="completed" name="Completed" fill={c.s2} radius={[0, 4, 4, 0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
