import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  text: string;
  children?: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [placement, setPlacement] = useState<'above' | 'below'>('above');
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // If the trigger is within 140px of the top of the viewport, show below
      setPlacement(rect.top < 140 ? 'below' : 'above');
    }
  }, [show]);

  return (
    <div className="relative inline-flex" ref={triggerRef}>
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {children || (
          <HelpCircle className="w-3.5 h-3.5 text-text-muted/50 hover:text-text-muted cursor-help transition-colors" />
        )}
      </div>
      {show && (
        <div
          className={`absolute z-50 left-1/2 -translate-x-1/2 pointer-events-none ${
            placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="bg-bg-elevated border border-border text-text-secondary text-[11px] leading-relaxed px-3.5 py-2 rounded-lg shadow-lg w-72 text-center whitespace-normal">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}
