import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <Logo />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <p className="text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 lg:block" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
        <div className="absolute bottom-12 left-12 right-12 space-y-3 text-white">
          <p className="text-3xl font-semibold leading-tight">Plan, track and ship, together.</p>
          <p className="text-white/80">Kanban boards, issue tracking and real-time collaboration for small, fast teams.</p>
        </div>
        <div className="absolute right-12 top-16 w-80 space-y-3 rotate-2">
          {['Fix dark mode contrast', 'Implement SSO login', 'Optimise slow dashboard query'].map((t, i) => (
            <div key={t} className="rounded-lg bg-white/90 p-3 text-sm text-slate-800 shadow-xl" style={{ marginLeft: i * 24 }}>
              <span className="text-xs text-slate-500">WEB-{12 + i * 7}</span>
              <p className="font-medium">{t}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
