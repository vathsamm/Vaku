import React, { useState, useEffect } from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { HiggsfieldConfig } from '../types';

interface HiggsfieldCreditsBadgeProps {
  onOpenSettings?: () => void;
  compact?: boolean;
}

export const HiggsfieldCreditsBadge: React.FC<HiggsfieldCreditsBadgeProps> = ({
  onOpenSettings,
  compact = false
}) => {
  const [status, setStatus] = useState<HiggsfieldConfig>({
    connected: false,
    credits: 0,
    tier: 'Pro Creator',
    model_default: 'flux-video-edit-3.0'
  });

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/higgsfield/status');
      const data = await res.json();
      if (data.ok && data.higgsfield) {
        setStatus(data.higgsfield);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchStatus();

    const handleUpdate = (e: any) => {
      if (e?.detail) {
        setStatus(prev => ({ ...prev, ...e.detail }));
      } else {
        fetchStatus();
      }
    };

    window.addEventListener('higgsfield-status-updated', handleUpdate);
    const interval = setInterval(fetchStatus, 30000); // 30s background sync

    return () => {
      window.removeEventListener('higgsfield-status-updated', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  if (!status.connected) {
    return (
      <button
        type="button"
        onClick={onOpenSettings}
        className="px-2 py-1 rounded-lg border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 shadow-xs"
        title="Connect Higgsfield AI Video (Flux Video Edit 3.0)"
      >
        <Sparkles size={13} className="text-purple-400" />
        <span className="text-[10px] sm:text-[11px] font-bold">Connect AI</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className={`rounded-lg border border-purple-500/50 bg-gradient-to-r from-purple-950/60 to-indigo-950/60 hover:from-purple-900/80 hover:to-indigo-900/80 text-white transition cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 shadow-sm shadow-purple-950/40 group ${
        compact ? 'px-1.5 py-0.5' : 'px-2 py-1'
      }`}
      title={`Higgsfield AI Connected: ${status.credits} credits remaining (Model: Flux Video Edit 3.0). Click to view details.`}
    >
      <div className="relative flex items-center justify-center">
        <Sparkles size={compact ? 11 : 13} className="text-amber-300 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] sm:text-[11px] font-mono font-black text-amber-300">
          {typeof status.credits === 'number' ? status.credits.toLocaleString(undefined, { maximumFractionDigits: 1 }) : status.credits}
        </span>
        <span className="text-[9px] font-bold text-purple-300 uppercase tracking-wider">
          cr
        </span>
      </div>
    </button>
  );
};
