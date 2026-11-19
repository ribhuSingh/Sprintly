import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, ListFilter, SearchX, X } from 'lucide-react';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  hasRole,
  type IssueDTO,
  type IssueListQuery,
  type IssuePriority,
  type IssueSortField,
  type IssueStatus,
} from '@sprintly/shared';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { AvatarStack, EmptyState, Skeleton } from '@/components/ui/misc';
import {
  Checkbox,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { useDebounce } from '@/hooks/useDebounce';
import { useProject, useProjectMembers } from '@/features/projects/hooks';
import { cn, shortDate } from '@/lib/utils';
import { useBulkUpdateIssues, useIssueList } from './hooks';
import { DueDate, LabelPill, PriorityIcon, StatusIcon } from './IssueBits';

const VISIBILITY_KEY = 'sprintly-table-columns';
const csv = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

export default function IssueListPage() {
  const { projectId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: projectData } = useProject(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const bulk = useBulkUpdateIssues(projectId);
  const canEdit = !!projectData && hasRole(projectData.myRole, 'member');
  const labels = useMemo(() => new Map((projectData?.project.labels ?? []).map((l) => [l.id, l])), [projectData]);

  // ---- All table state lives in the URL: shareable, survives refresh, back/forward works ----
  const sort = (params.get('sort') ?? 'createdAt') as IssueSortField;
  const dir = (params.get('dir') ?? 'desc') as 'asc' | 'desc';
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? 25);
  const statusFilter = csv(params.get('status')) as IssueStatus[];
  const priorityFilter = csv(params.get('priority')) as IssuePriority[];
  const assigneeFilter = csv(params.get('assignee'));

  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounce(search.trim(), 300);

  const update = (patch: Record<string, string | string[] | number | null>, resetPage = true) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(patch)) {
          const str = Array.isArray(v) ? v.join(',') : v === null ? '' : String(v);
          if (str) p.set(k, str);
          else p.delete(k);
        }
        if (resetPage) p.delete('page');
        return p;
      },
      { replace: true },
    );

  useEffect(() => {
    if ((params.get('q') ?? '') !== q) update({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const query: IssueListQuery = {
    q: q || undefined,
    status: statusFilter.length ? statusFilter : undefined,
    priority: priorityFilter.length ? priorityFilter : undefined,
    assignee: assigneeFilter.length ? assigneeFilter : undefined,
    sort,
    dir,
    page,
    pageSize,
  };
  const { data, isPending, isFetching, isPlaceholderData, error, refetch } = useIssueList(projectId, query);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  // Selection is per-page; clear it whenever the result set changes.
  const filterKey = `${statusFilter}|${priorityFilter}|${assigneeFilter}`;
  useEffect(() => setRowSelection({}), [projectId, page, pageSize, sort, dir, q, filterKey]);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      return JSON.parse(localStorage.getItem(VISIBILITY_KEY) ?? '') as VisibilityState;
    } catch {
      return { createdAt: false, estimate: false };
    }
  });
  useEffect(() => localStorage.setItem(VISIBILITY_KEY, JSON.stringify(columnVisibility)), [columnVisibility]);

  const columns = useMemo<ColumnDef<IssueDTO>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all on this page"
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox aria-label={`Select ${row.original.identifier}`} checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />
        ),
      },
      {
        id: 'number',
        header: 'ID',
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.identifier}</span>,
      },
      {
        id: 'title',
        header: 'Title',
        enableHiding: false,
        cell: ({ row }) => (
          <button
            className="flex min-w-0 items-center gap-2 text-left hover:underline cursor-pointer"
            onClick={() => setParams((p) => { p.set('issue', row.original.id); return p; })}
          >
            <span className="truncate font-medium">{row.original.title}</span>
            {row.original.labels.map((id) => {
              const l = labels.get(id);
              return l ? <LabelPill key={id} label={l} /> : null;
            })}
          </button>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <StatusIcon status={row.original.status} /> {STATUS_LABELS[row.original.status]}
          </span>
        ),
      },
      {
        id: 'priority',
        header: 'Priority',
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <PriorityIcon priority={row.original.priority} /> {PRIORITY_LABELS[row.original.priority]}
          </span>
        ),
      },
      {
        id: 'assignees',
        header: 'Assignees',
        enableSorting: false,
        cell: ({ row }) => (row.original.assignees.length ? <AvatarStack users={row.original.assignees} /> : <span className="text-muted-foreground">—</span>),
      },
      {
        id: 'dueDate',
        header: 'Due',
        cell: ({ row }) =>
          row.original.dueDate ? <DueDate iso={row.original.dueDate} done={row.original.status === 'done'} /> : <span className="text-muted-foreground">—</span>,
      },
      {
        id: 'estimate',
        header: 'Estimate',
        enableSorting: false,
        cell: ({ row }) => row.original.estimate ?? '—',
      },
      {
        id: 'createdAt',
        header: 'Created',
        cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{shortDate(row.original.createdAt)}</span>,
      },
      {
        id: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{shortDate(row.original.updatedAt)}</span>,
      },
    ],
    [labels, setParams],
  );

  const sorting: SortingState = [{ id: sort, desc: dir === 'desc' }];
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    pageCount: data?.pageCount ?? -1,
    state: { sorting, rowSelection, columnVisibility, pagination: { pageIndex: page - 1, pageSize } },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const s = next[0];
      update({ sort: s?.id ?? null, dir: s ? (s.desc ? 'desc' : 'asc') : null });
    },
    enableRowSelection: canEdit,
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const filterCount = statusFilter.length + priorityFilter.length + assigneeFilter.length;
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (error) return <ErrorFallback error={error} onReset={() => void refetch()} />;

  return (
    <div className="space-y-3 p-4 sm:p-6">
      {/* ---- Toolbar ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search issues…" aria-label="Search issues" className="h-8 w-56 pr-7" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-2 text-muted-foreground cursor-pointer" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ListFilter /> Filter{filterCount ? ` (${filterCount})` : ''}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-96 w-56 overflow-y-auto">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            {ISSUE_STATUSES.map((s) => (
              <DropdownMenuCheckboxItem key={s} checked={statusFilter.includes(s)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => update({ status: toggleIn(statusFilter, s) })}>
                <StatusIcon status={s} /> {STATUS_LABELS[s]}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Priority</DropdownMenuLabel>
            {[...ISSUE_PRIORITIES].reverse().map((p) => (
              <DropdownMenuCheckboxItem key={p} checked={priorityFilter.includes(p)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => update({ priority: toggleIn(priorityFilter, p) })}>
                <PriorityIcon priority={p} /> {PRIORITY_LABELS[p]}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Assignee</DropdownMenuLabel>
            {[{ id: 'me', name: 'Me' }, { id: 'none', name: 'Unassigned' }, ...members.map((m) => m.user)].map((u) => (
              <DropdownMenuCheckboxItem key={u.id} checked={assigneeFilter.includes(u.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => update({ assignee: toggleIn(assigneeFilter, u.id) })}>
                {u.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {filterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => update({ status: null, priority: null, assignee: null })}>
            <X /> Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isFetching && !isPending && <span className="text-xs text-muted-foreground" aria-live="polite">Updating…</span>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => c.toggleVisibility(!!v)}>
                  {typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ---- Bulk actions ---- */}
      {selectedIds.length > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.length} selected</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline">Set status</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              {ISSUE_STATUSES.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => bulk.mutate({ ids: selectedIds, patch: { status: s } }, { onSuccess: () => setRowSelection({}) })}>
                  <StatusIcon status={s} /> {STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline">Set priority</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              {[...ISSUE_PRIORITIES].reverse().map((p) => (
                <DropdownMenuItem key={p} onSelect={() => bulk.mutate({ ids: selectedIds, patch: { priority: p } }, { onSuccess: () => setRowSelection({}) })}>
                  <PriorityIcon priority={p} /> {PRIORITY_LABELS[p]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>Clear selection</Button>
        </div>
      )}

      {/* ---- Table ---- */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm" aria-busy={isFetching} aria-rowcount={data?.total}>
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className={cn('h-10 px-3 text-left font-medium text-muted-foreground', h.column.id === 'select' && 'w-10')}
                    >
                      {h.column.getCanSort() ? (
                        <button className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="size-3.5" /> : sorted === 'desc' ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className={cn('transition-opacity', isPlaceholderData && 'opacity-60')}>
            {isPending ? (
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="border-t">
                  {table.getVisibleLeafColumns().map((c) => (
                    <td key={c.id} className="px-3 py-3"><Skeleton className="h-4" /></td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="p-6">
                  <EmptyState
                    icon={SearchX}
                    title="No matching issues"
                    description="Try a different search or clear your filters."
                    action={filterCount || q ? <Button variant="outline" size="sm" onClick={() => { setSearch(''); update({ status: null, priority: null, assignee: null, q: null }); }}>Reset</Button> : undefined}
                  />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined} className="border-t transition-colors hover:bg-muted/40 data-[state=selected]:bg-primary/5">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn('px-3 py-2.5', cell.column.id === 'title' && 'max-w-md')}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ---- Pagination ---- */}
      <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          {data ? `${data.total === 0 ? 0 : (page - 1) * pageSize + 1}–${Math.min(page * pageSize, data.total)} of ${data.total}` : ' '}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-muted-foreground">
            Rows
            <NativeSelect className="h-8 w-20" value={pageSize} onChange={(e) => update({ pageSize: Number(e.target.value) })}>
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </NativeSelect>
          </label>
          <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => update({ page: page - 1 }, false)}>
            <ChevronLeft />
          </Button>
          <span className="tabular-nums">Page {page} / {data?.pageCount ?? '…'}</span>
          <Button variant="outline" size="icon" aria-label="Next page" disabled={!data || page >= data.pageCount} onClick={() => update({ page: page + 1 }, false)}>
            <ChevronRight />
          </Button>
        </div>
      </nav>
    </div>
  );
}
