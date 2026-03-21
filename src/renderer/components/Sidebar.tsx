import React from 'react';
import { LayoutDashboard, PenTool, Bookmark, Settings, Monitor } from 'lucide-react';
import type { Page } from '../App';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: React.ComponentType<any> }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'editor', label: 'Layout Editor', icon: PenTool },
  { page: 'presets', label: 'Presets', icon: Bookmark },
  { page: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-60 bg-bg-surface border-r border-border flex flex-col shrink-0">
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ page, label, icon: Icon }) => {
          const isActive = activePage === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`
                w-full flex items-center gap-3 px-3.5 py-2.5 text-sm rounded-lg transition-all
                ${isActive
                  ? 'text-commander bg-commander/10 font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-steel/40'
                }
              `}
            >
              <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-commander' : ''}`} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-text-muted" />
          <p className="font-brand text-[11px] text-text-muted tracking-wide">
            Mon<span className="font-bold">COM</span>
            <span className="ml-1.5 text-text-muted/60">v{__APP_VERSION__}</span>
          </p>
        </div>
        <p className="text-[10px] text-text-muted/50 mt-1 ml-5.5">
          by{' '}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); window.moncom?.openExternal('https://flarepoint.nl'); }}
            className="transition-colors hover:text-danger cursor-pointer"
          >
            Flarepoint
          </a>
        </p>
      </div>
    </aside>
  );
}
