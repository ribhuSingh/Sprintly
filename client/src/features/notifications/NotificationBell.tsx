import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import type { NotificationDTO } from '@sprintly/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { cn, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';

type Data = { notifications: NotificationDTO[]; unread: number };

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isPending } = useQuery({
    queryKey: qk.notifications,
    queryFn: ({ signal }) => api.get<Data>('/notifications', undefined, signal),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onMutate: (id) =>
      qc.setQueryData<Data>(qk.notifications, (old) =>
        old
          ? {
              notifications: old.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
              unread: Math.max(0, old.unread - (old.notifications.find((n) => n.id === id && !n.read) ? 1 : 0)),
            }
          : old,
      ),
  });

  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onMutate: async () => {
      const prev = qc.getQueryData<Data>(qk.notifications);
      qc.setQueryData<Data>(qk.notifications, (old) =>
        old ? { notifications: old.notifications.map((n) => ({ ...n, read: true })), unread: 0 } : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(qk.notifications, ctx?.prev),
  });

  const unread = data?.unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button variant="ghost" size="sm" disabled={!unread} onClick={() => markAll.mutate()}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isPending ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !data?.notifications.length ? (
            <div className="flex flex-col items-center gap-2 p-8 text-sm text-muted-foreground">
              <Inbox className="size-6" /> You’re all caught up
            </div>
          ) : (
            <ul>
              {data.notifications.map((n) => (
                <li key={n.id}>
                  <button
                    className={cn(
                      'flex w-full gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent cursor-pointer',
                      !n.read && 'bg-primary/5',
                    )}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      navigate(n.link);
                    }}
                  >
                    <Avatar user={n.actor} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2">
                        <span className="font-medium">{n.actor.name}</span> {n.message}
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
