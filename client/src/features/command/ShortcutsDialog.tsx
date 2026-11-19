import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/misc';
import { modKey } from '@/lib/utils';

const SECTIONS: { title: string; items: [string, string[]][] }[] = [
  {
    title: 'General',
    items: [
      ['Command palette', [modKey, 'K']],
      ['Create issue', ['C']],
      ['Search', ['/']],
      ['Toggle theme', ['T']],
      ['Show shortcuts', ['?']],
    ],
  },
  {
    title: 'Navigation',
    items: [
      ['Dashboard', ['G', 'D']],
      ['Projects', ['G', 'P']],
      ['Calendar', ['G', 'C']],
      ['Activity', ['G', 'A']],
      ['Settings', ['G', 'S']],
      ['Project board', ['G', 'B']],
      ['Project list', ['G', 'L']],
    ],
  },
  {
    title: 'Board (keyboard drag & drop)',
    items: [
      ['Pick up / drop card', ['Space']],
      ['Move card', ['←', '↑', '→', '↓']],
      ['Cancel drag', ['Esc']],
      ['Open card', ['Enter']],
    ],
  },
];

export default function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Everything in Sprintly can be done without a mouse.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.title}</h3>
              <dl className="space-y-1.5">
                {s.items.map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <dt>{label}</dt>
                    <dd className="flex gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
