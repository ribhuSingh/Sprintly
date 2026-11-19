import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNowStrict, format, isPast, isToday, parseISO } from 'date-fns';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const timeAgo = (iso: string) => formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
export const shortDate = (iso: string) => format(parseISO(iso), 'MMM d');
export const fullDate = (iso: string) => format(parseISO(iso), 'PPP');

export function dueState(iso: string | null, done = false): 'overdue' | 'today' | 'upcoming' | null {
  if (!iso || done) return null;
  const d = parseISO(iso);
  if (isToday(d)) return 'today';
  return isPast(d) ? 'overdue' : 'upcoming';
}

/** Random id used to recognise our own mutations when they echo back over the socket. */
export const mutationId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const modKey = isMac ? '⌘' : 'Ctrl';
