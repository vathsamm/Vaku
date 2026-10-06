import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, SlidersHorizontal, GripVertical, ChevronUp, ChevronDown, 
  Snowflake, Check, RotateCcw, Info
} from 'lucide-react';
import { FolderData } from '../types';

export interface BucketSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterBucketFid: string;
  masterBucketName: string;
  editorMode?: 'general' | 'ai';
  buckets: [string, FolderData][];
  currentOrder: string[];
  frozenBucketIds: string[];
  onSave: (newOrder: string[], newFrozenBucketIds: string[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const BucketSettingsModal: React.FC<BucketSettingsModalProps> = ({
  isOpen,
  onClose,
  masterBucketName,
  buckets,
  currentOrder,
  frozenBucketIds: initialFrozenIds,
  onSave,
  showToast
}) => {
  const [orderedBucketIds, setOrderedBucketIds] = useState<string[]>([]);
  const [frozenIds, setFrozenIds] = useState<Set<string>>(new Set());
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const bucketIds = buckets.map(b => b[0]);
    const initialList: string[] = [];
    currentOrder.forEach(id => {
      if (bucketIds.includes(id)) {
        initialList.push(id);
      }
    });
    bucketIds.forEach(id => {
      if (!initialList.includes(id)) {
        initialList.push(id);
      }
    });

    setOrderedBucketIds(initialList);
    setFrozenIds(new Set(initialFrozenIds || []));
  }, [isOpen, buckets, currentOrder, initialFrozenIds]);

  const bucketMap = useMemo(() => {
    return new Map(buckets.map(b => [b[0], b[1]]));
  }, [buckets]);

  if (!isOpen) return null;

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || toIdx >= orderedBucketIds.length) return;
    const nextList = [...orderedBucketIds];
    const [moved] = nextList.splice(fromIdx, 1);
    nextList.splice(toIdx, 0, moved);
    setOrderedBucketIds(nextList);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch (_) {}
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== targetIdx) {
      moveItem(draggedIdx, targetIdx);
    }
    setDraggedIdx(null);
  };

  const toggleFreezeBucket = (bucketId: string) => {
    setFrozenIds(prev => {
      const next = new Set(prev);
      if (next.has(bucketId)) {
        next.delete(bucketId);
      } else {
        next.add(bucketId);
      }
      return next;
    });
  };

  const handleResetOrder = () => {
    const naturalSorted = [...buckets].sort((a, b) => {
      const numA = parseInt(a[1].name.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b[1].name.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    }).map(b => b[0]);

    setOrderedBucketIds(naturalSorted);
    showToast("Reset bucket order to default", "info");
  };

  const handleSaveAndApply = () => {
    onSave(orderedBucketIds, Array.from(frozenIds));
    onClose();
    showToast("Bucket settings updated", "success");
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="p-3.5 sm:p-4 border-b border-gray-800 bg-gray-950 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 shrink-0">
              <SlidersHorizontal size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                Bucket Orientation & Freeze Settings
              </h3>
              <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                <span>Master Bucket:</span>
                <span className="text-blue-300 font-semibold">{masterBucketName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-4 flex-1">
          <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/50 text-[11px] text-blue-200 flex items-start gap-2">
            <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Drag or use arrows to change bucket orientation (bucket numbers remain untouched). Freezing a bucket will skip that entire bucket during timeline generation and auto-selection for this project.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
              Bucket Sequence ({orderedBucketIds.length})
            </span>
            <button
              type="button"
              onClick={handleResetOrder}
              className="text-[11px] font-bold text-gray-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
            >
              <RotateCcw size={11} />
              <span>Reset Default Order</span>
            </button>
          </div>

          <div className="space-y-2">
            {orderedBucketIds.map((bId, idx) => {
              const folder = bucketMap.get(bId);
              const name = folder?.name || `Bucket ${idx + 1}`;
              const isFrozen = frozenIds.has(bId);
              const isDragging = draggedIdx === idx;

              return (
                <div
                  key={bId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 select-none ${
                    isDragging
                      ? 'opacity-40 border-purple-500 bg-purple-950/20'
                      : isFrozen
                        ? 'bg-cyan-950/30 border-cyan-500/50 shadow-sm'
                        : 'bg-gray-950/80 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="cursor-grab active:cursor-grabbing p-1 text-gray-500 hover:text-gray-300 rounded"
                      title="Drag to reorder orientation"
                    >
                      <GripVertical size={16} />
                    </div>

                    <span className="w-5 h-5 rounded-md bg-gray-800 text-gray-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold text-xs truncate ${isFrozen ? 'text-cyan-300' : 'text-white'}`}>
                          {name}
                        </span>
                        {isFrozen && (
                          <span className="text-[9px] font-black font-mono px-1 py-0.2 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 flex items-center gap-0.5">
                            <Snowflake size={8} /> SKIPPED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center bg-gray-900 rounded-lg border border-gray-800 p-0.5">
                      <button
                        type="button"
                        onClick={() => moveItem(idx, idx - 1)}
                        disabled={idx === 0}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-20 transition cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(idx, idx + 1)}
                        disabled={idx === orderedBucketIds.length - 1}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-20 transition cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFreezeBucket(bId)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        isFrozen
                          ? 'bg-cyan-500 text-black shadow ring-1 ring-cyan-300'
                          : 'bg-gray-800 text-gray-300 hover:text-cyan-300 hover:bg-gray-700'
                      }`}
                      title={isFrozen ? "Unfreeze bucket (include in project)" : "Freeze bucket (skip this bucket completely from this project)"}
                    >
                      <Snowflake size={12} className={isFrozen ? 'stroke-[2.5]' : ''} />
                      <span>{isFrozen ? 'Frozen' : 'Freeze'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-gray-950 border-t border-gray-800 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAndApply}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Check size={14} />
            <span>Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
