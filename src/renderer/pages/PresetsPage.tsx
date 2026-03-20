import React, { useEffect, useState } from 'react';
import { Play, Trash2, Clock, Layers, Bookmark } from 'lucide-react';
import type { Preset } from '../../shared/types';
import type { Page } from '../App';

interface PresetsPageProps {
  onNavigate: (page: Page) => void;
}

export function PresetsPage({ onNavigate }: PresetsPageProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    window.moncom?.getPresets().then(setPresets);
  }, []);

  const handleApply = async (preset: Preset) => {
    setApplying(preset.id);
    try { await window.moncom?.applyPreset(preset); }
    finally { setApplying(null); }
  };

  const handleDelete = async (id: string) => {
    const updated = await window.moncom?.deletePreset(id);
    if (updated) setPresets(updated);
    setConfirmDelete(null);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-brand text-2xl font-bold text-text-primary tracking-tight">
            Presets
          </h1>
          <p className="text-sm text-text-secondary mt-1.5">
            Manage your saved monitor layouts
          </p>
        </div>
        <button
          onClick={() => onNavigate('editor')}
          className="flex items-center gap-2.5 px-5 py-2.5 bg-commander text-white rounded-lg hover:bg-commander-core transition-colors text-sm font-medium"
        >
          <Layers className="w-4 h-4" /> New Layout
        </button>
      </div>

      {presets.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="bg-bg-surface border border-border rounded-xl p-6 hover:border-commander/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-text-primary truncate">
                    {preset.name}
                  </h3>
                  <div className="flex items-center gap-4 mt-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Layers className="w-3.5 h-3.5 text-text-muted" />
                      {preset.layout.zones.length} zone(s)
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Clock className="w-3.5 h-3.5 text-text-muted" />
                      {new Date(preset.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApply(preset)}
                    disabled={applying === preset.id}
                    className="p-2.5 rounded-lg bg-commander/10 text-commander hover:bg-commander/20 transition-colors disabled:opacity-50"
                    title="Apply preset"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  {confirmDelete === preset.id ? (
                    <button
                      onClick={() => handleDelete(preset.id)}
                      className="px-3.5 py-2.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors text-xs font-semibold"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(preset.id)}
                      className="p-2.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Delete preset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Zone bar */}
              <div className="flex gap-1 mt-4">
                {preset.layout.zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={`h-1.5 rounded-full flex-1 ${zone.content ? 'bg-commander/40' : 'bg-bg-steel'}`}
                    title={zone.content?.label || 'Empty'}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-bg-surface border border-border rounded-xl p-16 text-center">
          <Bookmark className="w-12 h-12 text-text-muted/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-1.5">No presets yet</h3>
          <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">
            Create a layout in the editor, configure your zones, and save it as a preset for quick switching.
          </p>
          <button
            onClick={() => onNavigate('editor')}
            className="inline-flex items-center gap-2.5 px-6 py-3 bg-commander text-white rounded-lg hover:bg-commander-core transition-colors text-sm font-medium"
          >
            Open Layout Editor
          </button>
        </div>
      )}
    </div>
  );
}
