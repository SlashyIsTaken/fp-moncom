import React from 'react';

function LogoMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 2x2 grid of rounded squares — echoes the layout/zone concept */}
      <rect x="0.5" y="0.5" width="5.5" height="5.5" rx="1.2" fill="#2A7FFF" opacity="0.9" />
      <rect x="8" y="0.5" width="5.5" height="5.5" rx="1.2" fill="#2A7FFF" opacity="0.5" />
      <rect x="0.5" y="8" width="5.5" height="5.5" rx="1.2" fill="#2A7FFF" opacity="0.5" />
      <rect x="8" y="8" width="5.5" height="5.5" rx="1.2" fill="#2A7FFF" opacity="0.25" />
    </svg>
  );
}

export function TitleBar() {
  return (
    <div className="titlebar-drag flex items-center justify-between h-8 bg-bg-surface border-b border-border pl-3 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <LogoMark />
        <span className="font-brand text-[11px] font-semibold tracking-[0.15em] uppercase text-text-secondary">
          Moncom
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-commander/60 shadow-[0_0_6px_rgba(42,127,255,0.4)]" />
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
