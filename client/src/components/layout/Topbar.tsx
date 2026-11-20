import { useNavigate } from 'react-router';
import { Keyboard, LogOut, Menu, Moon, Plus, Search, Settings, Sun } from 'lucide-react';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { useTheme } from '@/hooks/useTheme';
import { modKey } from '@/lib/utils';
import { Button } from '../ui/button';
import { Avatar, Kbd } from '../ui/misc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '../ui/menu';
import { useUI } from './uiContext';

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const ui = useUI();
  const { theme, toggle } = useTheme();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
        <Menu />
      </Button>

      <button
        onClick={ui.openCommandPalette}
        className="flex h-8 w-full max-w-sm items-center gap-2 rounded-md border bg-card px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-input hover:text-foreground cursor-pointer"
        aria-label="Open command palette"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="flex-1 text-left">Search issues, projects, commands</span>
        <span className="hidden gap-1 sm:flex" aria-hidden>
          <Kbd>{modKey}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip content={<>New issue <Kbd className="ml-1">C</Kbd></>}>
          <Button size="sm" onClick={() => ui.openCreateIssue()} className="hidden sm:inline-flex">
            <Plus /> New issue
          </Button>
        </Tooltip>
        <Button size="icon" className="sm:hidden" onClick={() => ui.openCreateIssue()} aria-label="New issue">
          <Plus />
        </Button>
        <Tooltip content={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </Tooltip>
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 rounded-full cursor-pointer" aria-label="Account menu">
              <Avatar user={user} size="sm" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/settings')}>
              <Settings /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={ui.openShortcuts}>
              <Keyboard /> Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
