import React, { useEffect, useState } from 'react';
import { Save, Check, ChevronDown, ShieldAlert } from 'lucide-react';
import { Tooltip } from '../components/Tooltip';
import type { AppSettings, Preset } from '../../shared/types';

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    launchOnStartup: false,
    minimizeToTray: true,
    autoLaunchPreset: false,
    autoLaunchPresetId: null,
    runAsAdmin: false,
    hotkeys: {},
  });
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.moncom?.getSettings().then(setSettings);
    window.moncom?.getPresets().then(setPresets);
  }, []);

  const handleSave = async () => {
    // If auto-launch is off, clear the preset selection
    const toSave = {
      ...settings,
      autoLaunchPresetId: settings.autoLaunchPreset ? settings.autoLaunchPresetId : null,
    };
    await window.moncom?.saveSettings(toSave);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggle = (key: 'launchOnStartup' | 'minimizeToTray' | 'autoLaunchPreset' | 'runAsAdmin') => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedPresetName = presets.find(p => p.id === settings.autoLaunchPresetId)?.name;

  return (
    <div className="animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-brand text-2xl font-bold text-text-primary tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-text-secondary mt-1.5">
          Configure MonCOM behavior
        </p>
      </div>

      {/* General */}
      <section className="bg-bg-surface border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">General</h2>
        </div>

        <SettingRow
          title="Launch on startup"
          description="Start MonCOM automatically when Windows boots"
          checked={settings.launchOnStartup}
          onChange={() => toggle('launchOnStartup')}
        />

        <SettingRow
          title="Minimize to tray"
          description="Keep MonCOM running in the system tray when the window is closed"
          checked={settings.minimizeToTray}
          onChange={() => toggle('minimizeToTray')}
          last
        />
      </section>

      {/* Elevated Launch */}
      <section className="bg-bg-surface border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Administrator Privileges</h2>
          <Tooltip text="Only enable this if you need to launch applications that require administrator privileges. When enabled, MonCOM must be started as administrator for elevated apps to launch correctly." />
        </div>

        <SettingRow
          title="Run as administrator"
          description="Required only for launching applications that need elevated privileges"
          checked={settings.runAsAdmin}
          onChange={() => toggle('runAsAdmin')}
          last={!settings.runAsAdmin}
        />

        {settings.runAsAdmin && (
          <div className="px-6 py-4 border-t border-border flex items-start gap-3 bg-warning/5">
            <ShieldAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              With this enabled, MonCOM must be launched as administrator for elevated apps to work.
              If you do not need to launch programs that require elevation, leave this off.
              Right-click MonCOM and select <span className="text-text-primary font-medium">"Run as administrator"</span> when starting the app.
            </p>
          </div>
        )}
      </section>

      {/* Auto-launch */}
      <section className="bg-bg-surface border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Auto-launch Preset</h2>
          <Tooltip text="When enabled, MonCOM will automatically apply your chosen preset when the app starts. Combine with 'Launch on startup' to have your monitors configured automatically after every boot." />
        </div>

        <SettingRow
          title="Enable auto-launch"
          description="Automatically apply a preset when MonCOM starts"
          checked={settings.autoLaunchPreset}
          onChange={() => toggle('autoLaunchPreset')}
          last={!settings.autoLaunchPreset}
        />

        {settings.autoLaunchPreset && (
          <div className="px-6 py-5 border-t border-border">
            <label className="text-xs text-text-muted uppercase tracking-widest font-medium block mb-2">
              Preset to launch
            </label>
            {presets.length > 0 ? (
              <div className="relative">
                <select
                  value={settings.autoLaunchPresetId || ''}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    autoLaunchPresetId: e.target.value || null,
                  }))}
                  className="w-full appearance-none px-4 py-2.5 pr-10 bg-bg-dark border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-commander/60 transition-colors cursor-pointer"
                >
                  <option value="">Select a preset...</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                No presets available. Create one in the Layout Editor first.
              </p>
            )}
            {selectedPresetName && (
              <p className="text-xs text-text-secondary mt-2.5">
                <span className="text-commander font-medium">{selectedPresetName}</span> will be applied automatically when MonCOM starts.
              </p>
            )}
          </div>
        )}
      </section>

      {/* About */}
      <section className="bg-bg-surface border border-border rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-4">About</h2>
        <div className="space-y-2.5">
          <AboutRow label="Application" value="MonCOM — Monitor Commander" />
          <AboutRow label="Version" value={__APP_VERSION__} />
          <AboutRow label="Developer" value="Flarepoint" />
          <AboutRow label="Stack" value="Electron + React + TypeScript" />
        </div>
      </section>

      {/* Save */}
      <button
        onClick={handleSave}
        className="flex items-center gap-2.5 px-6 py-3 bg-commander text-white rounded-lg hover:bg-commander-core transition-colors text-sm font-medium"
      >
        {saved ? (
          <><Check className="w-4 h-4" /> Settings Saved!</>
        ) : (
          <><Save className="w-4 h-4" /> Save Settings</>
        )}
      </button>
    </div>
  );
}

function SettingRow({ title, description, checked, onChange, last }: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  last?: boolean;
}) {
  return (
    <div className={`px-6 py-5 flex items-center justify-between gap-6 ${last ? '' : 'border-b border-border'}`}>
      <div>
        <p className="text-sm text-text-primary font-medium">{title}</p>
        <p className="text-xs text-text-secondary mt-1">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
          checked ? 'bg-commander' : 'bg-bg-steel'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${
            checked ? 'left-5.5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs text-text-muted w-24 shrink-0">{label}</span>
      <span className="text-sm text-text-secondary">{value}</span>
    </div>
  );
}
