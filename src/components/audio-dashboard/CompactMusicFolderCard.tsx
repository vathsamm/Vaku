import React, { useRef, useCallback } from 'react';
import { AudioFolder } from '../../types';

interface CompactMusicFolderCardProps {
  folderId: string;
  folder: { id: string; name: string; ownerId?: string; is_root?: boolean; is_starred?: boolean; parent?: string | null };
  isStarred?: boolean;
  isFavoriteForProject?: boolean;
  isRoot?: boolean;
  itemCount?: number;
  onClick: () => void;
  onLongPress: () => void;
}

/**
 * Windows-style high fidelity Music Folder Icon
 * Matches the outside CompactFolderCard aesthetic with a specialized music embossed badge
 */
export const WindowsMusicFolderIcon: React.FC<{ size?: number; className?: string; isStarred?: boolean; isRoot?: boolean }> = ({ 
  size = 54, 
  className = '',
  isStarred = false,
  isRoot = false,
}) => (
  <svg 
    width={size} 
    height={size * 0.82} 
    viewBox="0 0 64 52" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={`drop-shadow-md transition-all duration-200 group-hover:scale-105 group-hover:drop-shadow-lg ${className}`}
  >
    <defs>
      <linearGradient id={isStarred ? "winStarMusicBack" : isRoot ? "winRootMusicBack" : "winMusicBack"} x1="0" y1="0" x2="0" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={isStarred ? "#f59e0b" : isRoot ? "#0284c7" : "#ec4899"} />
        <stop offset="100%" stopColor={isStarred ? "#b45309" : isRoot ? "#0369a1" : "#be185d"} />
      </linearGradient>
      <linearGradient id={isStarred ? "winStarMusicFront" : isRoot ? "winRootMusicFront" : "winMusicFront"} x1="0" y1="14" x2="0" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={isStarred ? "#fef08a" : isRoot ? "#7dd3fc" : "#f472b6"} />
        <stop offset="15%" stopColor={isStarred ? "#fde047" : isRoot ? "#38bdf8" : "#f43f5e"} />
        <stop offset="100%" stopColor={isStarred ? "#eab308" : isRoot ? "#0ea5e9" : "#e11d48"} />
      </linearGradient>
      <linearGradient id="winMusicSheet" x1="0" y1="10" x2="0" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#e2e8f0" />
      </linearGradient>
      <filter id="winMusicShadow" x="-2" y="12" width="68" height="42" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.28" />
      </filter>
    </defs>
    
    {/* Folder Back Tab */}
    <path 
      d="M4 8C4 5.79086 5.79086 4 8 4H23C25 4 27 6 28.5 7.5L30 9H56C58.2091 9 60 10.7909 60 13V43C60 45.2091 58.2091 47 56 47H8C5.79086 47 4 45.2091 4 43V8Z" 
      fill={`url(#${isStarred ? "winStarMusicBack" : isRoot ? "winRootMusicBack" : "winMusicBack"})`} 
    />
    
    {/* Inner Music Sheet */}
    <rect x="12" y="8" width="40" height="24" rx="2" fill="url(#winMusicSheet)" opacity="0.9" />
    <line x1="16" y1="12" x2="28" y2="12" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="16" x2="42" y2="16" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="20" x2="36" y2="20" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />

    {/* Folder Front Flap */}
    <g filter="url(#winMusicShadow)">
      <path 
        d="M3 16.5C3 14.567 4.567 13 6.5 13H57.5C59.433 13 61 14.567 61 16.5L59.2 46.5C59.08 48.45 57.46 50 55.5 50H8.5C6.54 50 4.92 48.45 4.8 46.5L3 16.5Z" 
        fill={`url(#${isStarred ? "winStarMusicFront" : isRoot ? "winRootMusicFront" : "winMusicFront"})`} 
      />
    </g>

    {/* Top Highlight Line */}
    <path 
      d="M6.5 14H57.5" 
      stroke="#ffffff" 
      strokeWidth="1.2" 
      strokeLinecap="round" 
      opacity="0.8" 
    />

    {/* Embossed Music Symbol on Folder Front */}
    {isStarred ? (
      <path 
        d="M32 23L34.5 28L40 28.8L36 32.7L37 38.2L32 35.5L27 38.2L28 32.7L24 28.8L29.5 28L32 23Z" 
        fill="#ffffff" 
        fillOpacity="0.85" 
      />
    ) : (
      <g opacity="0.85">
        {/* Double eighth note */}
        <circle cx="27" cy="36" r="3.2" fill="#ffffff" />
        <circle cx="37" cy="33" r="3.2" fill="#ffffff" />
        <rect x="29.2" y="24" width="2" height="12" fill="#ffffff" />
        <rect x="39.2" y="21" width="2" height="12" fill="#ffffff" />
        <polygon points="29.2,24 41.2,21 41.2,23.5 29.2,26.5" fill="#ffffff" />
      </g>
    )}
  </svg>
);

export const CompactMusicFolderCard: React.FC<CompactMusicFolderCardProps> = ({
  folder,
  isStarred = false,
  isFavoriteForProject = false,
  isRoot = false,
  itemCount = 0,
  onClick,
  onLongPress
}) => {
  const timerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const effectiveStarred = isStarred || isFavoriteForProject;

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
      title={`${folder.name}${itemCount > 0 ? ` (${itemCount} tracks)` : ''}`}
    >
      {/* Folder Icon with Red Bubble Counter */}
      <div className="relative flex items-center justify-center pt-1">
        <WindowsMusicFolderIcon 
          size={52} 
          isStarred={effectiveStarred} 
          isRoot={isRoot} 
        />
        {itemCount > 0 && (
          <div className="absolute -top-1 -right-2 z-10 animate-in zoom-in-75 duration-150 pointer-events-none">
            <span 
              className="flex items-center justify-center min-w-[20px] h-[20px] px-1 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white font-extrabold text-[10px] sm:text-[11px] font-mono rounded-full shadow-lg shadow-red-950/80 border-2 border-gray-950 ring-1 ring-red-400/40"
              title={`${itemCount} tracks inside`}
            >
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          </div>
        )}
      </div>

      {/* Folder Name */}
      <div className="mt-1 w-full max-w-full overflow-hidden px-0.5">
        <span 
          className="text-[10px] sm:text-[11px] font-medium text-gray-200 group-hover:text-white transition-colors duration-150 truncate block w-full text-center select-none"
          title={folder.name}
        >
          {folder.name}
        </span>
        {isFavoriteForProject ? (
          <span className="mt-0.5 inline-block text-[8px] sm:text-[9px] font-mono text-amber-300 font-bold px-1.5 py-0.2 rounded bg-amber-950/70 border border-amber-600/40">
            ⭐ Favorite
          </span>
        ) : isStarred ? (
          <span className="mt-0.5 inline-block text-[8px] sm:text-[9px] font-mono text-amber-300 font-bold px-1.5 py-0.2 rounded bg-amber-950/70 border border-amber-600/40">
            ⭐ Starred
          </span>
        ) : null}
      </div>
    </div>
  );
};
