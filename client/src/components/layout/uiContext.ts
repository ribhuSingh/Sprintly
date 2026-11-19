import { createContext, useContext } from 'react';
import type { IssueStatus } from '@sprintly/shared';

export interface CreateIssueOptions {
  projectId?: string;
  status?: IssueStatus;
}

export interface UIContextValue {
  openCommandPalette: () => void;
  openShortcuts: () => void;
  openCreateIssue: (opts?: CreateIssueOptions) => void;
  openCreateProject: () => void;
}

export const UIContext = createContext<UIContextValue | null>(null);

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside <AppLayout>');
  return ctx;
}
