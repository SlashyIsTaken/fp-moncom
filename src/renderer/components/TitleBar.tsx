import React from 'react';
import { Monitor } from 'lucide-react';

export function TitleBar() {
  return (
    <div className="titlebar-drag flex items-center justify-between h-8 bg-bg-surface border-b border-border pl-3 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <Monitor className="w-3.5 h-3.5 text-commander" />
        <span className="font-brand text-xs tracking-wide text-text-primary">
          Mon<span className="font-extrabold text-commander">COM</span>
        </span>
        <span className="text-[9px] text-text-muted/60 font-medium ml-0.5">
          Monitor Commander
        </span>
      </div>

      {/* Windows-style window controls */}
      <div className="titlebar-no-drag flex items-center h-full">
        {/* Minimize */}
        <button
          onClick={() => window.moncom?.windowMinimize()}
          className="w-[46px] h-full flex items-center justify-center hover:bg-[#ffffff1a] transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="#9AA3AD" />
          </svg>
        </button>

        {/* Maximize */}
        <button
          onClick={() => window.moncom?.windowMaximize()}
          className="w-[46px] h-full flex items-center justify-center hover:bg-[#ffffff1a] transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="0.5" y="0.5" width="9" height="9" stroke="#9AA3AD" strokeWidth="1" />
          </svg>
        </button>

        {/* Close */}
        <button
          onClick={() => window.moncom?.windowClose()}
          className="w-[46px] h-full flex items-center justify-center hover:bg-[#c42b1c] transition-colors group"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 1L9 9M9 1L1 9" stroke="#9AA3AD" strokeWidth="1.2" className="group-hover:stroke-white" />
          </svg>
        </button>
      </div>
    </div>
  );
}
