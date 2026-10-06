import React, { useRef, useCallback } from 'react';
import { FolderData } from '../types';

interface CompactFolderCardProps {
  folderId: string;
  folder: FolderData;
  isMaster: boolean;
  itemCount?: number;
  countLabel?: string;
  onClick: () => void;
  onLongPress: () => void;
}

export const WindowsFolderIcon: React.FC<{ size?: number; className?: string }> = ({ size = 56, className = '' }) => (
  <svg 
    width={size} 
    height={size * 0.82} 
    viewBox="0 0 64 52" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={`drop-shadow-md transition-all duration-200 group-hover:scale-105 group-hover:drop-shadow-lg ${className}`}
  >
    <defs>
      <linearGradient id="winFolderBack" x1="0" y1="0" x2="0" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="winFolderFront" x1="0" y1="14" x2="0" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="15%" stopColor="#fde047" />
        <stop offset="100%" stopColor="#eab308" />
      </linearGradient>
      <linearGradient id="winFolderSheet" x1="0" y1="10" x2="0" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#e2e8f0" />
      </linearGradient>
      <filter id="winFolderShadow" x="-2" y="12" width="68" height="42" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.25" />
      </filter>
    </defs>
    <path 
      d="M4 8C4 5.79086 5.79086 4 8 4H23C25 4 27 6 28.5 7.5L30 9H56C58.2091 9 60 10.7909 60 13V43C60 45.2091 58.2091 47 56 47H8C5.79086 47 4 45.2091 4 43V8Z" 
      fill="url(#winFolderBack)" 
    />
    <rect x="12" y="8" width="40" height="24" rx="2" fill="url(#winFolderSheet)" opacity="0.9" />
    <line x1="16" y1="12" x2="30" y2="12" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="16" x2="44" y2="16" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="20" x2="38" y2="20" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
    <g filter="url(#winFolderShadow)">
      <path 
        d="M3 16.5C3 14.567 4.567 13 6.5 13H57.5C59.433 13 61 14.567 61 16.5L59.2 46.5C59.08 48.45 57.46 50 55.5 50H8.5C6.54 50 4.92 48.45 4.8 46.5L3 16.5Z" 
        fill="url(#winFolderFront)" 
      />
    </g>
    <path 
      d="M6.5 14H57.5" 
      stroke="#ffffff" 
      strokeWidth="1.2" 
      strokeLinecap="round" 
      opacity="0.8" 
    />
  </svg>
);

export const WindowsMasterFolderIcon: React.FC<{ size?: number; className?: string }> = ({ size = 56, className = '' }) => (
  <svg 
    width={size} 
    height={size * 0.82} 
    viewBox="0 0 64 52" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={`drop-shadow-md transition-all duration-200 group-hover:scale-105 group-hover:drop-shadow-lg ${className}`}
  >
    <defs>
      <linearGradient id="winMasterBack" x1="0" y1="0" x2="0" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#4338ca" />
      </linearGradient>
      <linearGradient id="winMasterFront" x1="0" y1="14" x2="0" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="25%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
      <linearGradient id="winMasterSheet" x1="0" y1="10" x2="0" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#e2e8f0" />
      </linearGradient>
      <filter id="winMasterShadow" x="-2" y="12" width="68" height="42" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.3" />
      </filter>
    </defs>
    <path 
      d="M4 8C4 5.79086 5.79086 4 8 4H23C25 4 27 6 28.5 7.5L30 9H56C58.2091 9 60 10.7909 60 13V43C60 45.2091 58.2091 47 56 47H8C5.79086 47 4 45.2091 4 43V8Z" 
      fill="url(#winMasterBack)" 
    />
    <rect x="12" y="8" width="40" height="24" rx="2" fill="url(#winMasterSheet)" opacity="0.9" />
    <rect x="14" y="11" width="5" height="3" rx="0.5" fill="#64748b" />
    <rect x="22" y="11" width="5" height="3" rx="0.5" fill="#64748b" />
    <rect x="30" y="11" width="5" height="3" rx="0.5" fill="#64748b" />
    <rect x="38" y="11" width="5" height="3" rx="0.5" fill="#64748b" />
    <rect x="45" y="11" width="5" height="3" rx="0.5" fill="#64748b" />
    <g filter="url(#winMasterShadow)">
      <path 
        d="M3 16.5C3 14.567 4.567 13 6.5 13H57.5C59.433 13 61 14.567 61 16.5L59.2 46.5C59.08 48.45 57.46 50 55.5 50H8.5C6.54 50 4.92 48.45 4.8 46.5L3 16.5Z" 
        fill="url(#winMasterFront)" 
      />
    </g>
    <path 
      d="M6.5 14H57.5" 
      stroke="#ffffff" 
      strokeWidth="1.2" 
      strokeLinecap="round" 
      opacity="0.85" 
    />
    <rect x="26" y="27" width="12" height="10" rx="1.5" fill="#ffffff" fillOpacity="0.22" stroke="#ffffff" strokeWidth="1" />
    <line x1="28" y1="28" x2="30" y2="30" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />
    <line x1="34" y1="28" x2="36" y2="30" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />
    <line x1="28" y1="33" x2="30" y2="35" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />
    <line x1="34" y1="33" x2="36" y2="35" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />
  </svg>
);

export const CompactFolderCard: React.FC<CompactFolderCardProps> = ({
  folder,
  isMaster,
  itemCount = 0,
  onClick,
  onLongPress
}) => {
  const timerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const startPress = useCallback((clientX: number, clientY: number) => {
    isLongPressRef.current = false;
    touchStartPosRef.current = { x: clientX, y: clientY };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof window !== 'undefined' && window.navigator?.vibrate) {
        try { window.navigator.vibrate(40); } catch (_) {}
      }
      onLongPress();
    }, 450);
  }, [onLongPress]);

  const cancelPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !e.touches[0]) return;
    const diffX = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
    const diffY = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
    if (diffX > 10 || diffY > 10) {
      cancelPress();
    }
  }, [cancelPress]);

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }
    onClick();
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
      onMouseDown={(e) => startPress(e.clientX, e.clientY)}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={(e) => {
        if (e.touches[0]) {
          startPress(e.touches[0].clientX, e.touches[0].clientY);
        }
      }}
      onTouchEnd={cancelPress}
      onTouchMove={handleTouchMove}
      className="group select-none flex flex-col items-center justify-start p-2 sm:p-2.5 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 hover:bg-white/5 border border-transparent hover:border-gray-800 text-center relative w-full"
      title={`${folder.name}${itemCount > 0 ? ` (${itemCount} items)` : ''}`}
    >
      <div className="relative flex items-center justify-center pt-1">
        {isMaster ? <WindowsMasterFolderIcon size={52} /> : <WindowsFolderIcon size={52} />}
        {itemCount > 0 && (
          <div className="absolute -top-1 -right-2 z-10 animate-in zoom-in-75 duration-150">
            <span 
              className="flex items-center justify-center min-w-[20px] h-[20px] px-1 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white font-extrabold text-[10px] sm:text-[11px] font-mono rounded-full shadow-lg shadow-red-950/80 border-2 border-gray-950 ring-1 ring-red-400/40"
              title={`${itemCount} items inside`}
            >
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          </div>
        )}
      </div>

      <div className="mt-1 w-full max-w-full overflow-hidden px-0.5">
        <span 
          className="text-[10px] sm:text-[11px] font-medium text-gray-200 group-hover:text-white transition-colors duration-150 truncate block w-full text-center select-none"
          title={folder.name}
        >
          {folder.name}
        </span>
        {folder.is_virtual_duplicate && (
          <span className="mt-0.5 inline-block text-[8px] sm:text-[9px] font-mono text-pink-300 font-bold px-1.5 py-0.2 rounded bg-pink-950/70 border border-pink-700/50">
            {folder.sync_with_source ? 'Live' : 'Copy'}
          </span>
        )}
      </div>
    </div>
  );
};
