import React, { useEffect, useState, useCallback } from 'react';
import { Monitor, Save, Trash2, Play, Globe, AppWindow, Grid2x2, Grid3x3, Columns2, Rows2, Check, FolderOpen } from 'lucide-react';
import { Tooltip } from '../components/Tooltip';
import type { MonitorInfo, Zone, ZoneContent, Preset } from '../../shared/types';

type SplitTemplate = {
  name: string;
  icon: React.ComponentType<any>;
  zones: { x: number; y: number; width: number; height: number }[];
};

const splitTemplates: SplitTemplate[] = [
  { name: 'Full', icon: Monitor, zones: [{ x: 0, y: 0, width: 1, height: 1 }] },
  { name: '2 Columns', icon: Columns2, zones: [
    { x: 0, y: 0, width: 0.5, height: 1 },
    { x: 0.5, y: 0, width: 0.5, height: 1 },
  ]},
  { name: '2 Rows', icon: Rows2, zones: [
    { x: 0, y: 0, width: 1, height: 0.5 },
    { x: 0, y: 0.5, width: 1, height: 0.5 },
  ]},
  { name: '2x2 Grid', icon: Grid2x2, zones: [
    { x: 0, y: 0, width: 0.5, height: 0.5 },
    { x: 0.5, y: 0, width: 0.5, height: 0.5 },
    { x: 0, y: 0.5, width: 0.5, height: 0.5 },
    { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  ]},
  { name: '3x3 Grid', icon: Grid3x3, zones: [
    { x: 0, y: 0, width: 1/3, height: 1/3 },
    { x: 1/3, y: 0, width: 1/3, height: 1/3 },
    { x: 2/3, y: 0, width: 1/3, height: 1/3 },
    { x: 0, y: 1/3, width: 1/3, height: 1/3 },
    { x: 1/3, y: 1/3, width: 1/3, height: 1/3 },
    { x: 2/3, y: 1/3, width: 1/3, height: 1/3 },
    { x: 0, y: 2/3, width: 1/3, height: 1/3 },
    { x: 1/3, y: 2/3, width: 1/3, height: 1/3 },
    { x: 2/3, y: 2/3, width: 1/3, height: 1/3 },
  ]},
  { name: 'Main + Side', icon: Columns2, zones: [
    { x: 0, y: 0, width: 0.7, height: 1 },
    { x: 0.7, y: 0, width: 0.3, height: 0.5 },
    { x: 0.7, y: 0.5, width: 0.3, height: 0.5 },
  ]},
];

let zoneIdCounter = 0;
function makeZoneId() {
  return `zone-${Date.now()}-${zoneIdCounter++}`;
}

export function LayoutEditorPage() {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    window.moncom?.getMonitors().then(setMonitors);
  }, []);

  const applyTemplate = useCallback((monitorId: string, template: SplitTemplate) => {
    setZones(prev => {
      const others = prev.filter(z => z.monitorId !== monitorId);
      const newZones = template.zones.map(z => ({
        id: makeZoneId(), monitorId,
        x: z.x, y: z.y, width: z.width, height: z.height,
        content: null,
      }));
      return [...others, ...newZones];
    });
    setSelectedZone(null);
  }, []);

  const updateZoneContent = useCallback((zoneId: string, content: ZoneContent | null) => {
    setZones(prev => prev.map(z => z.id === zoneId ? { ...z, content } : z));
  }, []);

  const removeZone = useCallback((zoneId: string) => {
    setZones(prev => prev.filter(z => z.id !== zoneId));
    if (selectedZone === zoneId) setSelectedZone(null);
  }, [selectedZone]);

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    const preset: Preset = {
      id: `preset-${Date.now()}`,
      name: presetName.trim(),
      layout: { id: `layout-${Date.now()}`, zones },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await window.moncom?.savePreset(preset);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleApply = async () => {
    const preset: Preset = {
      id: 'temp', name: 'Quick Apply',
      layout: { id: 'temp', zones },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await window.moncom?.applyPreset(preset);
  };

  // Monitor map viewport
  const monitorBounds = monitors.length > 0 ? {
    minX: Math.min(...monitors.map(m => m.x)),
    minY: Math.min(...monitors.map(m => m.y)),
    maxX: Math.max(...monitors.map(m => m.x + m.width)),
    maxY: Math.max(...monitors.map(m => m.y + m.height)),
  } : { minX: 0, minY: 0, maxX: 1920, maxY: 1080 };

  const totalW = monitorBounds.maxX - monitorBounds.minX;
  const totalH = monitorBounds.maxY - monitorBounds.minY;
  const previewScale = Math.min(500 / totalW, 280 / totalH);

  const selectedZoneData = zones.find(z => z.id === selectedZone);
  const configuredCount = zones.filter(z => z.content).length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-brand text-2xl font-bold text-text-primary tracking-tight">
            Layout Editor
          </h1>
          <p className="text-sm text-text-secondary mt-1.5">
            Split your monitors into zones and assign content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip text="Launches all configured zones on your actual monitors right now." />
          <button
            onClick={handleApply}
            disabled={configuredCount === 0}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-commander text-white rounded-lg hover:bg-commander-core transition-colors text-sm font-medium disabled:opacity-40"
          >
            <Play className="w-4 h-4" /> Apply Layout
          </button>
        </div>
      </div>

      {/* Two-column layout that stacks on narrow widths */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left: Monitor map + templates */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Monitor map */}
          <div className="bg-bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                Monitor Map
              </h3>
              <Tooltip text="This shows your connected monitors as detected by Windows. Click a zone to select it, then configure it in the right panel." />
            </div>
            <div className="flex items-center justify-center">
              <div
                className="relative"
                style={{ width: totalW * previewScale, height: totalH * previewScale }}
              >
                {monitors.map((m) => {
                  const mx = (m.x - monitorBounds.minX) * previewScale;
                  const my = (m.y - monitorBounds.minY) * previewScale;
                  const mw = m.width * previewScale;
                  const mh = m.height * previewScale;
                  const monitorZones = zones.filter(z => z.monitorId === m.id);

                  return (
                    <div
                      key={m.id}
                      className="absolute border-2 border-border/80 rounded-lg bg-bg-dark overflow-hidden"
                      style={{ left: mx, top: my, width: mw, height: mh }}
                    >
                      {monitorZones.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted pointer-events-none">
                          <Monitor className="w-5 h-5 mb-1 opacity-30" />
                          <span className="text-[10px] opacity-50">{m.name}</span>
                        </div>
                      )}
                      {monitorZones.map((zone) => (
                        <div
                          key={zone.id}
                          onClick={() => setSelectedZone(zone.id)}
                          className={`absolute border transition-all cursor-pointer flex items-center justify-center
                            ${selectedZone === zone.id
                              ? 'border-commander bg-commander/20 z-10'
                              : zone.content
                                ? 'border-commander/30 bg-commander/8 hover:border-commander/50'
                                : 'border-border/60 hover:border-text-muted/40 bg-bg-steel/20'
                            }
                          `}
                          style={{
                            left: `${zone.x * 100}%`, top: `${zone.y * 100}%`,
                            width: `${zone.width * 100}%`, height: `${zone.height * 100}%`,
                          }}
                        >
                          <span className="text-[9px] text-text-secondary truncate px-1">
                            {zone.content?.label || 'Empty'}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Split templates */}
          <div className="bg-bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                Split Templates
              </h3>
              <Tooltip text="Choose a template to divide a monitor into zones. You can apply different templates to each monitor." />
            </div>
            <div className="space-y-5">
              {monitors.map((m) => (
                <div key={m.id}>
                  <p className="text-xs text-text-secondary font-medium mb-3">{m.name}</p>
                  <div className="flex gap-2 flex-wrap">
                    {splitTemplates.map((tmpl) => (
                      <button
                        key={tmpl.name}
                        onClick={() => applyTemplate(m.id, tmpl)}
                        className="flex items-center gap-2 px-3.5 py-2 bg-bg-dark border border-border rounded-lg text-xs text-text-secondary hover:border-commander/50 hover:text-commander transition-all"
                      >
                        <tmpl.icon className="w-3.5 h-3.5" />
                        {tmpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Zone config + save */}
        <div className="w-full xl:w-80 shrink-0 space-y-6">
          {/* Zone Properties */}
          <div className="bg-bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                Zone Properties
              </h3>
              <Tooltip text="Select a zone on the map, then assign a URL or application to it here." />
            </div>
            {selectedZoneData ? (
              <ZoneEditor
                zone={selectedZoneData}
                onUpdate={(content) => updateZoneContent(selectedZoneData.id, content)}
                onRemove={() => removeZone(selectedZoneData.id)}
              />
            ) : (
              <div className="py-8 text-center">
                <Monitor className="w-8 h-8 text-text-muted/30 mx-auto mb-2" />
                <p className="text-xs text-text-muted">
                  Select a zone on the monitor map
                </p>
              </div>
            )}
          </div>

          {/* Save as Preset */}
          <div className="bg-bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                Save as Preset
              </h3>
              <Tooltip text="Save this layout so you can quickly apply it later from the Dashboard or Presets page." />
            </div>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="w-full px-4 py-2.5 bg-bg-dark border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commander/60 transition-colors"
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim() || zones.length === 0}
              className="w-full mt-3 flex items-center justify-center gap-2.5 px-4 py-2.5 bg-commander text-white rounded-lg hover:bg-commander-core transition-colors text-sm font-medium disabled:opacity-40"
            >
              {saveStatus === 'saved' ? (
                <><Check className="w-4 h-4" /> Saved!</>
              ) : (
                <><Save className="w-4 h-4" /> Save Preset</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Zone Editor ─── */
function ZoneEditor({ zone, onUpdate, onRemove }: {
  zone: Zone;
  onUpdate: (content: ZoneContent | null) => void;
  onRemove: () => void;
}) {
  const [type, setType] = useState<'url' | 'application'>(zone.content?.type || 'url');
  const [target, setTarget] = useState(zone.content?.target || '');
  const [label, setLabel] = useState(zone.content?.label || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setType(zone.content?.type || 'url');
    setTarget(zone.content?.target || '');
    setLabel(zone.content?.label || '');
    setShowAdvanced(!!zone.content?.label);
  }, [zone.id, zone.content]);

  /** Auto-generate a display label from the target */
  const autoLabel = (t: string, contentType: 'url' | 'application') => {
    if (!t) return '';
    if (contentType === 'url') {
      try { return new URL(t).hostname.replace('www.', ''); } catch { return t; }
    }
    // Extract filename from path
    const parts = t.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1]?.replace(/\.exe$/i, '') || t;
  };

  const handleApply = () => {
    if (!target.trim()) { onUpdate(null); return; }
    const displayLabel = label.trim() || autoLabel(target.trim(), type);
    onUpdate({ type, target: target.trim(), label: displayLabel });
  };

  return (
    <div className="space-y-4">
      {/* Type toggle */}
      <div className="flex gap-2">
        {(['url', 'application'] as const).map((t) => {
          const isActive = type === t;
          const Icon = t === 'url' ? Globe : AppWindow;
          return (
            <button
              key={t}
              onClick={() => { setType(t); setTarget(''); setLabel(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all
                ${isActive
                  ? 'bg-commander/15 text-commander border border-commander/30'
                  : 'bg-bg-dark border border-border text-text-secondary hover:text-text-primary'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              {t === 'url' ? 'URL' : 'App'}
            </button>
          );
        })}
      </div>

      {type === 'url' ? (
        <FieldInput
          label="URL"
          value={target}
          onChange={setTarget}
          placeholder="https://example.com"
        />
      ) : (
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-widest font-medium">
            Executable Path
          </label>
          <div className="flex gap-2 mt-1.5">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="C:\Program Files\..."
              className="flex-1 min-w-0 px-4 py-2.5 bg-bg-dark border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commander/60 transition-colors"
            />
            <button
              onClick={async () => {
                const path = await window.moncom?.pickExecutable();
                if (path) setTarget(path);
              }}
              className="px-3 py-2.5 bg-bg-dark border border-border rounded-lg text-text-muted hover:border-commander/50 hover:text-commander transition-all"
              title="Browse for executable"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Preview auto-label */}
      {target.trim() && !showAdvanced && (
        <p className="text-[11px] text-text-muted">
          Displays as: <span className="text-text-secondary">{autoLabel(target.trim(), type)}</span>
        </p>
      )}

      {/* Advanced: manual title override */}
      {showAdvanced ? (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-[10px] text-text-muted uppercase tracking-widest font-medium">
              Window title hint
            </label>
            <Tooltip text="Optional fallback. If MonCOM can't find the launched window automatically, it will search for a window whose title contains this text." />
          </div>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Auto-detected (leave empty)"
            className="w-full px-4 py-2.5 bg-bg-dark border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commander/60 transition-colors"
          />
        </div>
      ) : (
        <button
          onClick={() => setShowAdvanced(true)}
          className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
        >
          + Advanced options
        </button>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleApply}
          className="flex-1 px-4 py-2.5 bg-commander text-white rounded-lg text-xs font-medium hover:bg-commander-core transition-colors"
        >
          Assign Content
        </button>
        <button
          onClick={onRemove}
          className="px-3 py-2.5 bg-bg-dark border border-border text-text-muted rounded-lg hover:border-danger/60 hover:text-danger transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-text-muted uppercase tracking-widest font-medium">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1.5 px-4 py-2.5 bg-bg-dark border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-commander/60 transition-colors"
      />
    </div>
  );
}
