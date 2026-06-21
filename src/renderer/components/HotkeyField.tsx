import React, { useEffect, useState } from 'react';
import { Keyboard, X, AlertTriangle } from 'lucide-react';

interface HotkeyFieldProps {
  /** Current Electron accelerator (e.g. "CommandOrControl+Alt+1"), or undefined. */
  value?: string;
  /** Called with a new accelerator, or null to clear the binding. */
  onChange: (accelerator: string | null) => void;
  /** True when this accelerator failed to register (taken by Windows or another app). */
  conflict?: boolean;
}

const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta'];

const KEY_MAP: Record<string, string> = {
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Enter: 'Return', ' ': 'Space', Escape: 'Escape', Backspace: 'Backspace',
  Delete: 'Delete', Tab: 'Tab', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown',
};

/** Turn a KeyboardEvent into an Electron accelerator, or null if it isn't a valid chord. */
function eventToAccelerator(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.includes(e.key)) return null; // modifier alone, keep waiting

  const mods: string[] = [];
  if (e.ctrlKey) mods.push('CommandOrControl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  if (e.metaKey) mods.push('Super');
  if (mods.length === 0) return null; // require a modifier for a global shortcut

  let key: string | null = null;
  if (/^[a-zA-Z]$/.test(e.key)) key = e.key.toUpperCase();
  else if (/^[0-9]$/.test(e.key)) key = e.key;
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.key)) key = e.key;
  else if (KEY_MAP[e.key]) key = KEY_MAP[e.key];
  else if (e.key.length === 1) key = e.key.toUpperCase();
  if (!key) return null;

  return [...mods, key].join('+');
}

/** Format an accelerator for display (Ctrl/Win instead of CommandOrControl/Super). */
function formatAccelerator(accel: string): string {
  return accel.replace('CommandOrControl', 'Ctrl').replace('Super', 'Win').replace(/\+/g, ' + ');
}

export function HotkeyField({ value, onChange, conflict }: HotkeyFieldProps) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecording(false);
        return;
      }
      const accel = eventToAccelerator(e);
      if (accel) {
        onChange(accel);
        setRecording(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording, onChange]);

  if (recording) {
    return (
      <button
        onClick={() => setRecording(false)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-commander bg-commander/10 text-xs text-commander font-medium animate-pulse"
      >
        <Keyboard className="w-3.5 h-3.5" />
        Press a key combination…
      </button>
    );
  }

  if (value) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          onClick={() => setRecording(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
            conflict
              ? 'border-warning/50 bg-warning/10 text-warning'
              : 'border-border bg-bg-steel text-text-primary hover:border-commander/40'
          }`}
          title={conflict ? 'This shortcut is already in use by another app' : 'Click to change'}
        >
          {conflict && <AlertTriangle className="w-3.5 h-3.5" />}
          {formatAccelerator(value)}
        </button>
        <button
          onClick={() => onChange(null)}
          className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          title="Remove shortcut"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setRecording(true)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed border-border text-xs text-text-secondary hover:text-commander hover:border-commander/40 transition-colors"
    >
      <Keyboard className="w-3.5 h-3.5" />
      Add shortcut
    </button>
  );
}
