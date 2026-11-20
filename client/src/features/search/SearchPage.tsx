import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, SearchX } from 'lucide-react';
import {
  ISSUE_STATUSES,
  PRIORITY_RANK,
  STATUS_LABELS,
  type IssueStatus,
  type SearchResultsDTO,
} from '@sprintly/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { timeAgo } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Input, NativeSelect } from '@/components/ui/input';
import { AvatarStack, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { PriorityIcon, StatusIcon } from '@/features/issues/IssueBits';

type SortKey = 'relevance' | 'updated' | 'priority';

/** Global search across every project you can see. Query, filters and sort live in the URL. */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const q = useDebounce(text.trim(), 250);
  const status = (params.get('status') ?? '') as IssueStatus | '';
  const project = params.get('project') ?? '';
  const sort = (params.get('sort') ?? 'relevance') as SortKey;
  const inputRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: string) =>
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    }, { replace: true });

  useEffect(() => set('q', q), [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => inputRef.current?.focus(), []);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: qk.search(q),
    queryFn: ({ signal }) => api.get<SearchResultsDTO>('/search', { q, limit: 50 }, signal),
    enabled: q.length >= 1,
    placeholderData: (prev) => prev,
  });

  const issues = useMemo(() => {
    let list = data?.issues ?? [];
    if (status) list = list.filter((i) => i.status === status);
    if (project) list = list.filter((i) => i.project === project);
    if (sort === 'updated') list = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (sort === 'priority') list = [...list].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
    return list;
  }, [data, status, project, sort]);

  const projectOptions = useMemo(() => {
    const m = new Map<string, string>();
    data?.issues.forEach((i) => m.set(i.project, i.projectName));
    return [...m];
  }, [data]);

  return (
    <>
      <PageHeader title="Search">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            ref={inputRef}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search issues by title, ID or description…"
            aria-label="Search everything"
            className="h-10 pl-9 text-base"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <NativeSelect aria-label="Filter by status" className="h-8 w-40" value={status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Any status</option>
            {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Filter by project" className="h-8 w-44" value={project} onChange={(e) => set('project', e.target.value)}>
            <option value="">Any project</option>
            {projectOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Sort results" className="h-8 w-40" value={sort} onChange={(e) => set('sort', e.target.value === 'relevance' ? '' : e.target.value)}>
            <option value="relevance">Best match</option>
            <option value="updated">Recently updated</option>
            <option value="priority">Priority</option>
          </NativeSelect>
        </div>
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6" aria-live="polite" aria-busy={isFetching}>
        {!q ? (
          <EmptyState icon={Search} title="Search across all projects" description="Find issues by title, identifier (e.g. WEB-12) or description, and projects by name." />
        ) : error ? (
          <ErrorFallback error={error} onReset={() => void refetch()} />
        ) : !data ? (
          <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : issues.length === 0 && data.projects.length === 0 ? (
          <EmptyState icon={SearchX} title={`No results for “${q}”`} description="Check the spelling or try fewer words." />
        ) : (
          <>
            {data.projects.length > 0 && !status && (
              <section>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Projects</h2>
                <ul className="flex flex-wrap gap-2">
                  {data.projects.map((p) => (
                    <li key={p.id}>
                      <Link to={`/projects/${p.id}/board`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
                        <span className="size-2.5 rounded-sm" style={{ backgroundColor: p.color }} /> {p.name}
                        <span className="text-xs text-muted-foreground">{p.key}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Issues · {issues.length}{data.issues.length === 50 ? '+' : ''}
              </h2>
              <ul className="divide-y rounded-lg border bg-card">
                {issues.map((i) => (
                  <li key={i.id}>
                    <Link to={`/projects/${i.project}/board?issue=${i.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40">
                      <StatusIcon status={i.status} />
                      <PriorityIcon priority={i.priority} />
                      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{i.identifier}</span>
                      <span className="min-w-0 flex-1 truncate font-medium"><Highlight text={i.title} q={q} /></span>
                      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
                        <span className="size-2 rounded-sm" style={{ backgroundColor: i.projectColor }} /> {i.projectName}
                      </span>
                      <AvatarStack users={i.assignees} size="xs" />
                      <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{timeAgo(i.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/30">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}
