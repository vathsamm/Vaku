export const formatRecentlyUsed = (timestamp?: number, usageCount?: number): string | null => {
  if (!timestamp || typeof timestamp !== 'number') return null;
  const now = Date.now();
  const diffMs = now - timestamp;
  if (diffMs < 0) return null;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  if (diffDays > 7) return null;

  let timeStr = '';
  if (diffDays < 1) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      timeStr = `${diffMins}m ago`;
    } else {
      timeStr = `${diffHours}h ago`;
    }
  } else {
    const days = Math.floor(diffDays);
    if (days === 1) timeStr = '1d ago';
    else timeStr = `${days}d ago`;
  }

  const countStr = typeof usageCount === 'number' && usageCount > 0 ? ` · ${usageCount}x` : '';
  return `${timeStr}${countStr}`;
};
