import React, { useEffect, useState } from 'react';
import { Monitor, Play, Square, Zap, LayoutGrid, Bookmark, ArrowRight } from 'lucide-react';
import type { MonitorInfo, Preset } from '../../shared/types';
import type { Page } from '../App';

interface DashboardPageProps {
  onNavigate: (page: Page) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    window.moncom?.getMonitors().then(setMonitors);
    window.moncom?.getPresets().then(setPresets);
    window.moncom?.hasLaunchedWindows().then(setHasLaunched);
  }, []);

  const handleApplyPreset = async (preset: Preset) => {
    setIsApplying(true);
    setActivePreset(preset.id);
    try {
      const result = await window.moncom?.applyPreset(preset);
      if (result) {
        const closeFailureCount = result.closeReport?.appWindowsFailed.length ?? 0;
        if (result.failedZones.length > 0 || closeFailureCount > 0) {
          const parts: string[] = [];
          if (result.failedZones.length > 0) {
            parts.push(`${result.failedZones.length} zone(s) failed to launch`);
          }
          if (closeFailureCount > 0) {
            parts.push(`${closeFailureCount} window(s) could not be closed`);
          }
          setStatusMessage(parts.join('. ') + '.');
        } else {
          setStatusMessage(null);
        }
      }
      setHasLaunched(await window.moncom?.hasLaunchedWindows() ?? false);
    } catch (e) {
      console.error('Failed to apply preset:', e);
      setStatusMessage('Failed to apply preset. See logs for details.');
    }
    setIsApplying(false);
  };

  const handleCloseAll = async () => {
    const report = await window.moncom?.closeAllZones();
    if (report && report.appWindowsFailed.length > 0) {
      setStatusMessage(`${report.appWindowsFailed.length} app window(s) could not be closed cleanly.`);
    } else {
      setStatusMessage(null);
    }
    setActivePreset(null);
    setHasLaunched(false);
  };

  const handleIdentifyMonitors = () => {
    window.moncom?.identifyMonitors();
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-brand text-2xl font-bold text-text-primary tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-text-secondary mt-1.5">
          Monitor overview and quick actions
        </p>
        {statusMessage && (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Monitor Overview */}
      <section className="mb-10">
        <SectionHeader title="Detected Monitors" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {monitors.map((m) => (
            <div
              key={m.id}
              className="bg-bg-surface border border-border rounded-xl p-5 hover:border-commander/40 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-lg bg-commander/10 flex items-center justify-center shrink-0 group-hover:bg-commander/15 transition-colors">
                  <Monitor className="w-5 h-5 text-commander" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {m.name}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {m.width} &times; {m.height}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Tag>{m.scaleFactor * 100}% scale</Tag>
                    <Tag>x:{m.x} y:{m.y}</Tag>
                    {m.isPrimary && <Tag accent>Primary</Tag>}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {monitors.length === 0 && (
            <div className="col-span-full bg-bg-surface border border-border rounded-xl p-10 text-center">
              <Monitor className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-secondary">Detecting monitors...</p>
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-10">
        <SectionHeader title="Quick Actions" />
        <div className="flex gap-3 flex-wrap mt-4">
          <ActionButton
            icon={LayoutGrid}
            label="New Layout"
            primary
            onClick={() => onNavigate('editor')}
          />
          {hasLaunched && (
            <ActionButton
              icon={Square}
              label="Close Launched Windows"
              danger
              onClick={handleCloseAll}
            />
          )}
          <ActionButton
            icon={Monitor}
            label="Identify Monitors"
            onClick={handleIdentifyMonitors}
          />
          <ActionButton
            icon={Zap}
            label="Refresh Monitors"
            onClick={() => window.moncom?.getMonitors().then(setMonitors)}
          />
        </div>
      </section>

      {/* Presets */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Presets" />
          {presets.length > 0 && (
            <button
              onClick={() => onNavigate('presets')}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-commander transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {presets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                disabled={isApplying}
                className={`
                  text-left bg-bg-surface border rounded-xl p-5 transition-all
                  ${activePreset === preset.id
                    ? 'border-commander glow-commander'
                    : 'border-border hover:border-commander/40'
                  }
                  disabled:opacity-50
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {preset.name}
                  </span>
                  <Play className={`w-4 h-4 ${activePreset === preset.id ? 'text-commander' : 'text-text-muted'}`} />
                </div>
                <p className="text-xs text-text-secondary">
                  {preset.layout.zones.filter(z => z.content).length} zone(s) configured
                </p>
                {/* Mini bar preview */}
                <div className="flex gap-1 mt-3">
                  {preset.layout.zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`h-1.5 rounded-full flex-1 ${zone.content ? 'bg-commander/40' : 'bg-bg-steel'}`}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-bg-surface border border-border rounded-xl p-12 text-center">
            <Bookmark className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <h3 className="text-base font-semibold text-text-primary mb-1">No presets yet</h3>
            <p className="text-sm text-text-secondary mb-5">
              Create a layout in the editor and save it as a preset
            </p>
            <button
              onClick={() => onNavigate('editor')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-commander text-white rounded-lg hover:bg-commander-core transition-colors text-sm font-medium"
            >
              <LayoutGrid className="w-4 h-4" />
              Create your first layout
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Sub-components ─── */

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest">
      {title}
    </h2>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
        accent
          ? 'bg-commander/15 text-commander'
          : 'bg-bg-steel/60 text-text-muted'
      }`}
    >
      {children}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  label,
  primary,
  danger,
  onClick,
}: {
  icon: React.ComponentType<any>;
  label: string;
  primary?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  const base = "flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-all";
  const variant = primary
    ? "bg-commander text-white hover:bg-commander-core"
    : danger
      ? "bg-bg-surface border border-border text-text-secondary hover:border-danger/60 hover:text-danger"
      : "bg-bg-surface border border-border text-text-secondary hover:border-commander/50 hover:text-commander";

  return (
    <button onClick={onClick} className={`${base} ${variant}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
