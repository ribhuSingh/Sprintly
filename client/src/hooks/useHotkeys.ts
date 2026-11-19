import { useEffect, useRef } from 'react';

/**
 * Minimal keyboard shortcut hook supporting:
 *   - single keys:      'c', '?', '/'
 *   - modifiers:        'mod+k'  (⌘ on macOS, Ctrl elsewhere)
 *   - Linear-style sequences: 'g d' (press g, then d within 1s)
 * Shortcuts without a modifier are ignored while typing in inputs/editable elements.
 */
export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

const isTypingTarget = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.getAttribute('role') === 'combobox';
};

export function useHotkeys(map: HotkeyMap, enabled = true) {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;
    let pending: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      const bindings = mapRef.current;

      if (mod) {
        const combo = `mod+${key}`;
        if (bindings[combo]) {
          e.preventDefault();
          bindings[combo](e);
        }
        return;
      }
      if (e.altKey || isTypingTarget(e.target)) return;
      // Ignore when a modal (other than ours) has focus trapped.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

      if (pending) {
        const seq = `${pending} ${key}`;
        pending = null;
        clearTimeout(timer);
        if (bindings[seq]) {
          e.preventDefault();
          bindings[seq](e);
          return;
        }
      }
      if (Object.keys(bindings).some((k) => k.startsWith(`${key} `))) {
        pending = key;
        timer = setTimeout(() => (pending = null), 1000);
        return;
      }
      const single = bindings[e.key] ?? bindings[key];
      if (single) {
        e.preventDefault();
        single(e);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
    };
  }, [enabled]);
}
