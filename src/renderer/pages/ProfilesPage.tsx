import React, { useEffect, useState } from 'react';
import { Workflow, Plus, Trash2, Copy, FolderOpen, ChevronUp, ChevronDown, X, Save, Pencil } from 'lucide-react';
import type { AppProfile, ProfileStep, ProfileAction } from '../../shared/types';
import { normalizeExe } from '../../shared/exe';
import { Tooltip } from '../components/Tooltip';

type Entry = { profile: AppProfile; bundled: boolean };

const COMMON_KEYS: [string, number][] = [['Enter', 13], ['Tab', 9], ['Escape', 27], ['Space', 32]];

function blankStep(): ProfileStep {
  return { waitFor: { exe: '' }, timeoutMs: 15000 };
}

export function ProfilesPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<AppProfile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { window.moncom?.getProfiles().then(setEntries); }, []);

  const startNew = () => {
    setDraft({ id: `profile-${Date.now()}`, name: '', match: { exe: '' }, steps: [{ ...blankStep(), position: true }] });
    setIsNew(true);
    setStatus(null);
  };
  const startEdit = (p: AppProfile) => { setDraft(structuredClone(p)); setIsNew(false); setStatus(null); };
  const startDuplicate = (p: AppProfile) => {
    setDraft({ ...structuredClone(p), id: `profile-${Date.now()}`, name: `${p.name} (copy)` });
    setIsNew(true);
    setStatus(null);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { setStatus('Give the profile a name.'); return; }
    if (!normalizeExe(draft.match.exe || '')) { setStatus('Set the exe this profile applies to.'); return; }
    if (draft.steps.length === 0) { setStatus('Add at least one step.'); return; }
    if (!draft.steps.some((s) => s.position)) { setStatus('Mark one step as the window to position (the "place this" toggle).'); return; }
    const cleaned: AppProfile = { ...draft, name: draft.name.trim(), match: { ...draft.match, exe: normalizeExe(draft.match.exe || '') } };
    setEntries(await window.moncom!.saveProfile(cleaned));
    setDraft(null);
  };

  const remove = async (id: string) => { setEntries(await window.moncom!.deleteProfile(id)); };

  if (draft) {
    return <ProfileEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} isNew={isNew} status={status} />;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-brand text-2xl font-bold text-text-primary tracking-tight">App Profiles</h1>
          <p className="text-sm text-text-secondary mt-1.5">Launch recipes for stubborn apps — ack a dialog, wait through login, then position the right window</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.moncom?.openProfilesFolder()} className="flex items-center gap-2 px-3 py-2.5 bg-bg-dark border border-border rounded-lg text-xs text-text-muted hover:text-text-secondary hover:border-commander/40 transition-all" title="Open the profiles folder">
            <FolderOpen className="w-4 h-4" /> Folder
          </button>
          <button onClick={startNew} className="flex items-center gap-2.5 px-5 py-2.5 bg-commander text-white rounded-lg hover:bg-commander-core transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> New Profile
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-bg-surface/50 px-3 py-2 text-[11px] text-text-muted">
        A profile attaches automatically by matching the launched app's exe. Apps without a profile use the normal single-window launch.
      </div>

      {entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map(({ profile, bundled }) => (
            <div key={profile.id} className="flex items-center gap-3 bg-bg-surface border border-border rounded-xl px-4 py-3">
              <Workflow className="w-5 h-5 text-commander shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary truncate">{profile.name}</h3>
                  {bundled && <span className="text-[9px] uppercase tracking-wider text-text-muted bg-bg-dark border border-border rounded px-1.5 py-0.5">Example</span>}
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  exe: <span className="text-text-secondary">{profile.match.exe || '—'}</span> · {profile.steps.length} step{profile.steps.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => startEdit(profile)} className="p-2 text-text-muted hover:text-commander transition-colors" title={bundled ? 'Edit (saves your own copy)' : 'Edit'}>
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => startDuplicate(profile)} className="p-2 text-text-muted hover:text-text-secondary transition-colors" title="Duplicate">
                <Copy className="w-4 h-4" />
              </button>
              {!bundled && (
                <button onClick={() => remove(profile.id)} className="p-2 text-text-muted hover:text-danger transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-bg-surface border border-border rounded-xl p-12 text-center">
          <Workflow className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-base font-semibold text-text-primary mb-1">No profiles yet</h3>
          <p className="text-sm text-text-secondary mb-5">Create one for an app that needs steps to launch (dialog, login, then its real window).</p>
          <button onClick={startNew} className="inline-flex items-center gap-2 px-5 py-2.5 bg-commander text-white rounded-lg hover:bg-commander-core transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> New Profile
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileEditor({ draft, setDraft, onSave, onCancel, isNew, status }: {
  draft: AppProfile;
  setDraft: (p: AppProfile) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
  status: string | null;
}) {
  const setStep = (i: number, patch: Partial<ProfileStep>) =>
    setDraft({ ...draft, steps: draft.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const setMatch = (i: number, patch: Partial<ProfileStep['waitFor']>) =>
    setStep(i, { waitFor: { ...draft.steps[i].waitFor, ...patch } });
  const addStep = () => setDraft({ ...draft, steps: [...draft.steps, blankStep()] });
  const removeStep = (i: number) => setDraft({ ...draft, steps: draft.steps.filter((_, idx) => idx !== i) });
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.steps.length) return;
    const next = [...draft.steps];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft({ ...draft, steps: next });
  };
  const setPosition = (i: number) =>
    setDraft({ ...draft, steps: draft.steps.map((s, idx) => ({ ...s, position: idx === i })) });

  const setActions = (i: number, actions: ProfileAction[]) => setStep(i, { do: actions.length ? actions : undefined });

  const browseExe = async () => {
    const picked = await window.moncom?.pickExecutable();
    if (picked) setDraft({ ...draft, match: { ...draft.match, exe: normalizeExe(picked) } });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-brand text-2xl font-bold text-text-primary tracking-tight">{isNew ? 'New Profile' : 'Edit Profile'}</h1>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2.5 bg-bg-dark border border-border rounded-lg text-xs text-text-muted hover:text-text-secondary transition-all">Cancel</button>
          <button onClick={onSave} className="flex items-center gap-2 px-5 py-2.5 bg-commander text-white rounded-lg hover:bg-commander-core transition-colors text-sm font-medium">
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>

      {status && <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">{status}</div>}

      <div className="bg-bg-surface border border-border rounded-xl p-4 mb-4 space-y-3">
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Name</label>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="DSS Client"
            className="w-full mt-1.5 px-3 py-2 bg-bg-dark border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commander/60" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Applies to exe</label>
            <Tooltip text="Type the app name or browse to its .exe. Paste a full path, the name with or without .exe, any casing — MonCOM normalizes it. 'C:\\…\\DSS Client.exe' becomes 'dss client'." />
          </div>
          <div className="flex gap-2 mt-1.5">
            <input value={draft.match.exe || ''} onChange={(e) => setDraft({ ...draft, match: { ...draft.match, exe: e.target.value } })} placeholder="dss client"
              className="flex-1 min-w-0 px-3 py-2 bg-bg-dark border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commander/60" />
            <button onClick={browseExe} className="px-3 py-2 bg-bg-dark border border-border rounded-lg text-text-muted hover:border-commander/50 hover:text-commander transition-all" title="Browse for the executable">
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>
          {draft.match.exe?.trim() && (
            <p className="text-[11px] text-text-muted mt-1.5">Matches launches of <span className="text-text-secondary">{normalizeExe(draft.match.exe) || '—'}</span></p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Steps</h4>
        <Tooltip text="Each step waits for a window, optionally acts on it, optionally waits for it to close, then continues. Mark the step whose window should be placed in the zone. For apps where every window shares a title, match by exe and rely on order + 'wait for close'." />
      </div>

      <div className="space-y-3">
        {draft.steps.map((step, i) => (
          <div key={i} className="bg-bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold text-text-secondary">Step {i + 1}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="p-1 text-text-muted hover:text-text-secondary disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveStep(i, 1)} disabled={i === draft.steps.length - 1} className="p-1 text-text-muted hover:text-text-secondary disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => removeStep(i)} className="p-1 text-text-muted hover:text-danger"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <label className="text-[10px] text-text-muted">Wait for a window matching</label>
            <div className="grid grid-cols-3 gap-2 mt-1 mb-2.5">
              <input value={step.waitFor.exe || ''} onChange={(e) => setMatch(i, { exe: e.target.value || undefined })} placeholder="exe"
                className="px-2 py-1.5 bg-bg-dark border border-border rounded text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commander/60" />
              <input value={step.waitFor.titleContains || ''} onChange={(e) => setMatch(i, { titleContains: e.target.value || undefined })} placeholder="title contains"
                className="px-2 py-1.5 bg-bg-dark border border-border rounded text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commander/60" />
              <input value={step.waitFor.className || ''} onChange={(e) => setMatch(i, { className: e.target.value || undefined })} placeholder="class"
                className="px-2 py-1.5 bg-bg-dark border border-border rounded text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commander/60" />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-2.5 text-[11px] text-text-secondary">
              <label className="flex items-center gap-1.5">
                timeout
                <input type="number" min={0} step={1000} value={step.timeoutMs ?? 15000} onChange={(e) => setStep(i, { timeoutMs: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-16 px-1 py-0.5 bg-bg-dark border border-border rounded text-[10px] text-center focus:outline-none focus:border-commander/60" /> ms
              </label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!step.optional} onChange={(e) => setStep(i, { optional: e.target.checked || undefined })} /> optional</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!step.waitClose} onChange={(e) => setStep(i, { waitClose: e.target.checked || undefined })} /> wait for close</label>
              <label className="flex items-center gap-1.5" title="The window placed in the zone"><input type="radio" name="position" checked={!!step.position} onChange={() => setPosition(i)} /> place this window</label>
            </div>

            <StepActions actions={step.do || []} onChange={(a) => setActions(i, a)} />
          </div>
        ))}
      </div>

      <button onClick={addStep} className="mt-3 flex items-center gap-2 px-3 py-2 bg-bg-dark border border-border rounded-lg text-[11px] text-text-secondary hover:border-commander/40 hover:text-commander transition-all">
        <Plus className="w-3.5 h-3.5" /> Add step
      </button>
    </div>
  );
}

function StepActions({ actions, onChange }: { actions: ProfileAction[]; onChange: (a: ProfileAction[]) => void }) {
  const update = (i: number, patch: Partial<ProfileAction>) => onChange(actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const remove = (i: number) => onChange(actions.filter((_, idx) => idx !== i));
  const add = () => onChange([...actions, { type: 'key', vkCode: 13 }]);

  return (
    <div className="border-t border-border/60 pt-2.5">
      <label className="text-[10px] text-text-muted">Then do (optional)</label>
      <div className="space-y-1.5 mt-1">
        {actions.map((act, i) => {
          const isCommonKey = act.type === 'key' && COMMON_KEYS.some(([, vk]) => vk === act.vkCode);
          return (
            <div key={i} className="flex items-center gap-1.5">
              <select value={act.type} onChange={(e) => update(i, { type: e.target.value as ProfileAction['type'] })}
                className="px-1.5 py-1 bg-bg-dark border border-border rounded text-[10px] text-text-secondary focus:outline-none focus:border-commander/60">
                <option value="key">Press key</option>
                <option value="click">Click</option>
                <option value="wait">Wait</option>
              </select>

              {act.type === 'key' && (
                <>
                  <select value={isCommonKey ? String(act.vkCode) : 'custom'} onChange={(e) => update(i, { vkCode: e.target.value === 'custom' ? (act.vkCode ?? 0) : parseInt(e.target.value) })}
                    className="px-1.5 py-1 bg-bg-dark border border-border rounded text-[10px] text-text-secondary focus:outline-none focus:border-commander/60">
                    {COMMON_KEYS.map(([l, vk]) => <option key={vk} value={vk}>{l}</option>)}
                    <option value="custom">VK code…</option>
                  </select>
                  {!isCommonKey && (
                    <input type="number" value={act.vkCode ?? 0} onChange={(e) => update(i, { vkCode: parseInt(e.target.value) || 0 })}
                      className="w-14 px-1 py-1 bg-bg-dark border border-border rounded text-[10px] text-center focus:outline-none focus:border-commander/60" title="Virtual key code" />
                  )}
                </>
              )}

              {act.type === 'click' && (
                <>
                  <input type="number" min={0} max={100} value={Math.round((act.x ?? 0.5) * 100)} onChange={(e) => update(i, { x: Math.max(0, Math.min(1, (parseInt(e.target.value) || 0) / 100)) })}
                    className="w-12 px-1 py-1 bg-bg-dark border border-border rounded text-[10px] text-center focus:outline-none focus:border-commander/60" title="X %" />
                  <input type="number" min={0} max={100} value={Math.round((act.y ?? 0.5) * 100)} onChange={(e) => update(i, { y: Math.max(0, Math.min(1, (parseInt(e.target.value) || 0) / 100)) })}
                    className="w-12 px-1 py-1 bg-bg-dark border border-border rounded text-[10px] text-center focus:outline-none focus:border-commander/60" title="Y %" />
                  <label className="flex items-center gap-1 text-[10px] text-text-muted"><input type="checkbox" checked={!!act.right} onChange={(e) => update(i, { right: e.target.checked || undefined })} /> right</label>
                </>
              )}

              {act.type === 'wait' && (
                <input type="number" min={0} step={100} value={act.ms ?? 0} onChange={(e) => update(i, { ms: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-16 px-1 py-1 bg-bg-dark border border-border rounded text-[10px] text-center focus:outline-none focus:border-commander/60" title="Milliseconds" />
              )}

              <button onClick={() => remove(i)} className="text-text-muted hover:text-danger shrink-0 ml-auto"><X className="w-3 h-3" /></button>
            </div>
          );
        })}
        <button onClick={add} className="text-[11px] text-commander hover:text-commander-core transition-colors">+ Add action</button>
      </div>
    </div>
  );
}
