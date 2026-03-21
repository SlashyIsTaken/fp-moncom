import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { LayoutEditorPage } from './pages/LayoutEditorPage';
import { PresetsPage } from './pages/PresetsPage';
import { SettingsPage } from './pages/SettingsPage';

export type Page = 'dashboard' | 'editor' | 'presets' | 'settings';

const isPreRelease = (() => {
  const major = parseInt(__APP_VERSION__.split('.')[0], 10);
  return major < 1;
})();

export function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage onNavigate={setActivePage} />;
      case 'editor': return <LayoutEditorPage />;
      case 'presets': return <PresetsPage onNavigate={setActivePage} />;
      case 'settings': return <SettingsPage />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-dark">
      <TitleBar />
      {isPreRelease && <AlphaBanner />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

function AlphaBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative flex items-center justify-center px-4 py-1.5 bg-warning/10 border-b border-warning/20 text-warning shrink-0">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mr-2" />
      <span className="text-[11px] font-medium">
        Pre-release v{__APP_VERSION__} — this build is a work in progress and may not function as expected.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-4 text-[10px] text-warning/60 hover:text-warning transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
