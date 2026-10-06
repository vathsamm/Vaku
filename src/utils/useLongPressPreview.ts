import { useState, useRef, useCallback, useEffect } from 'react';
import { LongPressPreviewData } from '../components/LongPressVideoPreview';

export function useLongPressPreview() {
  const [activePreview, setActivePreview] = useState<LongPressPreviewData | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef<boolean>(false);

  const startLongPress = useCallback((clipData: LongPressPreviewData, e: React.TouchEvent | React.MouseEvent | React.PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') || target?.closest('a') || target?.closest('input') || target?.closest('label')) {
      return;
    }

    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    startPosRef.current = { x: clientX, y: clientY };
    didLongPressRef.current = false;

    if (timerRef.current) clearTimeout(timerRef.current);
    // Standard long-press duration (420ms) prevents normal clicks and taps from misfiring
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      try { navigator.vibrate?.(30); } catch (_) {}
      setActivePreview(clipData);
    }, 420);
  }, []);

  const moveLongPress = useCallback((e: React.TouchEvent | React.MouseEvent | React.PointerEvent) => {
    if (!startPosRef.current || !timerRef.current) return;
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const dist = Math.hypot(clientX - startPosRef.current.x, clientY - startPosRef.current.y);
    if (dist > 10) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const endLongPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setActivePreview(null);
  }, []);

  const checkDidLongPress = useCallback((): boolean => {
    const wasLongPress = didLongPressRef.current;
    didLongPressRef.current = false;
    return wasLongPress;
  }, []);

  // Cleanup pending timer on window blur, popstate or visibilitychange
  useEffect(() => {
    const cancelAll = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setActivePreview(null);
    };

    window.addEventListener('popstate', cancelAll);
    window.addEventListener('blur', cancelAll);
    document.addEventListener('visibilitychange', cancelAll);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      window.removeEventListener('popstate', cancelAll);
      window.removeEventListener('blur', cancelAll);
      document.removeEventListener('visibilitychange', cancelAll);
    };
  }, []);

  return {
    activePreview,
    startLongPress,
    moveLongPress,
    endLongPress,
    checkDidLongPress,
    closePreview: () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setActivePreview(null);
    },
  };
}
