import React, { useState, useEffect } from 'react';
import { X, Scissors, Layers, Clock, Sparkles, Check, AlertCircle, RefreshCw, Sliders } from 'lucide-react';
import { VideoEditorClip } from '../../../types';

export interface ChopStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: VideoEditorClip | null;
  onExecuteChop: (options: {
    mode: 'scene_cuts' | 'interval' | 'equal_parts';
    sensitivity?: number;
    min_shot_duration?: number;
    interval_seconds?: number;
    num_parts?: number;
  }) => Promise<boolean>;
  isChopping: boolean;
}

export const ChopStudioModal: React.FC<ChopStudioModalProps> = ({
  isOpen,
  onClose,
  clip,
  onExecuteChop,
  isChopping,
}) => {
  const [activeTab, setActiveTab] = useState<'scene_cuts' | 'equal_parts' | 'interval'>('scene_cuts');
  const [sensitivity, setSensitivity] = useState<number>(0.25); // Balanced adaptive default
  const [minShotDuration, setMinShotDuration] = useState<number>(0.8);
  const [equalPartsCount, setEqualPartsCount] = useState<number>(2);
  const [intervalSeconds, setIntervalSeconds] = useState<number>(4);

  // Preview state
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [previewResults, setPreviewResults] = useState<{
    cutPoints: number[];
    segmentsCount: number;
    message?: string;
  } | null>(null);

  // Reset preview when options or tab change
  useEffect(() => {
    setPreviewResults(null);
  }, [activeTab, sensitivity, minShotDuration, equalPartsCount, intervalSeconds, clip?.id]);

  if (!isOpen || !clip) return null;

  const clipDuration = clip.duration && clip.duration > 0 ? clip.duration : 5.0;
  const trimStart = clip.trim_start || 0;
  const trimEnd = clip.trim_end && clip.trim_end > trimStart ? clip.trim_end : clipDuration;
  const activeLength = Math.max(0.1, trimEnd - trimStart);

  const handlePreviewCuts = async () => {
    setIsPreviewing(true);
    setPreviewResults(null);
    try {
      const resp = await fetch('/api/video/chop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vid: clip.vid,
          file_id: clip.file_id,
          url: clip.url,
          trim_start: trimStart,
          trim_end: trimEnd,
          mode: activeTab,
          sensitivity,
          min_shot_duration: minShotDuration,
          num_parts: equalPartsCount,
          interval_seconds: intervalSeconds,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        setPreviewResults({
          cutPoints: data.cut_points || [],
          segmentsCount: data.segments_count || 1,
        });
      } else {
        setPreviewResults({
          cutPoints: [],
          segmentsCount: 1,
          message: data.error || 'Preview failed',
        });
      }
    } catch (err: any) {
      setPreviewResults({
        cutPoints: [],
        segmentsCount: 1,
        message: err.message || 'Error running cut preview',
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleApply = async () => {
    const success = await onExecuteChop({
      mode: activeTab,
      sensitivity,
      min_shot_duration: minShotDuration,
      interval_seconds: intervalSeconds,
      num_parts: equalPartsCount,
    });
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[135] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-cyan-500/50 rounded-2xl w-full max-w-lg p-4 sm:p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-600/30 border border-cyan-500/40 rounded-xl text-cyan-300">
              <Scissors size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">Chop & Scene Cut Studio</h3>
              <p className="text-[11px] text-gray-400">Cut along exact scene transitions without false positives</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected Clip Info Card */}
        <div className="bg-gray-950/70 border border-gray-800/80 rounded-xl p-3 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">Selected Clip Target</span>
            <span className="text-xs font-semibold text-gray-200 truncate max-w-[200px] sm:max-w-[260px]">
              {clip.bucket_name ? `[${clip.bucket_name}] ` : ''}Clip ({activeLength.toFixed(1)}s)
            </span>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-[11px] font-mono text-cyan-300 font-bold">
              {trimStart.toFixed(1)}s → {trimEnd.toFixed(1)}s
            </span>
            <span className="text-[10px] text-gray-400">Active Timeline Span</span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 bg-gray-950/80 p-1 rounded-xl border border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab('scene_cuts')}
            className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activeTab === 'scene_cuts'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-850'
            }`}
          >
            <Sparkles size={14} className={activeTab === 'scene_cuts' ? 'text-cyan-200' : 'text-gray-400'} />
            <span>Scene Cuts</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('equal_parts')}
            className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activeTab === 'equal_parts'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-850'
            }`}
          >
            <Layers size={14} className={activeTab === 'equal_parts' ? 'text-cyan-200' : 'text-gray-400'} />
            <span>Equal Parts</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('interval')}
            className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
              activeTab === 'interval'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-850'
            }`}
          >
            <Clock size={14} className={activeTab === 'interval' ? 'text-cyan-200' : 'text-gray-400'} />
            <span>By Interval</span>
          </button>
        </div>

        {/* Tab 1: Smart Scene Cuts */}
        {activeTab === 'scene_cuts' && (
          <div className="flex flex-col gap-3.5 bg-gray-950/40 p-3 rounded-xl border border-gray-800/60">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-200 flex items-center justify-between">
                <span>Detection Sensitivity</span>
                <span className="text-[11px] text-cyan-400 font-mono font-bold">
                  {sensitivity === 0.25 ? 'Balanced (0.25)' : sensitivity === 0.40 ? 'Strict (0.40)' : sensitivity === 0.12 ? 'Sensitive (0.12)' : 'Ultra (0.05)'}
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setSensitivity(0.25)}
                  className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                    sensitivity === 0.25
                      ? 'border-cyan-400 bg-cyan-950/60 text-white ring-1 ring-cyan-400/40'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300">Balanced</span>
                    <span className="text-[9px] bg-cyan-900/80 text-cyan-200 px-1 rounded font-bold">Default</span>
                  </div>
                  <span className="text-[10px] text-gray-400 leading-tight">True camera cuts & scene changes.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSensitivity(0.40)}
                  className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                    sensitivity === 0.40
                      ? 'border-cyan-400 bg-cyan-950/60 text-white ring-1 ring-cyan-400/40'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <span className="text-xs font-bold text-gray-200">Strict</span>
                  <span className="text-[10px] text-gray-400 leading-tight">High threshold. Strong visual changes.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSensitivity(0.12)}
                  className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                    sensitivity === 0.12
                      ? 'border-cyan-400 bg-cyan-950/60 text-white ring-1 ring-cyan-400/40'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <span className="text-xs font-bold text-gray-200">Sensitive</span>
                  <span className="text-[10px] text-gray-400 leading-tight">Catches soft transitions & pacing shifts.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSensitivity(0.05)}
                  className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                    sensitivity === 0.05
                      ? 'border-cyan-400 bg-cyan-950/60 text-white ring-1 ring-cyan-400/40'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <span className="text-xs font-bold text-gray-200">Ultra</span>
                  <span className="text-[10px] text-gray-400 leading-tight">Subtle camera moves & continuous shots.</span>
                </button>
              </div>
            </div>

            {/* Minimum Shot Spacing */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-200 flex items-center justify-between">
                <span>Minimum Shot Distance</span>
                <span className="text-[11px] text-cyan-400 font-mono font-bold">{minShotDuration.toFixed(1)}s</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[0.8, 1.0, 1.5, 2.0].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setMinShotDuration(dur)}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition text-center ${
                      minShotDuration === dur
                        ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 ring-1 ring-cyan-400/30'
                        : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    {dur.toFixed(1)}s {dur === 1.0 ? '★' : ''}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-gray-500">Prevents rapid, jittery micro-slices from actor motion or camera shake.</span>
            </div>
          </div>
        )}

        {/* Tab 2: Equal Parts */}
        {activeTab === 'equal_parts' && (
          <div className="flex flex-col gap-3.5 bg-gray-950/40 p-3 rounded-xl border border-gray-800/60">
            <label className="text-xs font-bold text-gray-200 flex items-center justify-between">
              <span>Divide Clip into Equal Segments</span>
              <span className="text-[11px] text-cyan-400 font-mono font-bold">{equalPartsCount} Parts</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[2, 3, 4, 5].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setEqualPartsCount(cnt)}
                  className={`py-2 px-2 rounded-lg border text-xs font-bold transition text-center flex flex-col items-center gap-0.5 ${
                    equalPartsCount === cnt
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 ring-1 ring-cyan-400/30'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <span className="text-sm">{cnt} Clips</span>
                  <span className="text-[9.5px] font-mono text-gray-400">
                    {(activeLength / cnt).toFixed(1)}s each
                  </span>
                </button>
              ))}
            </div>
            <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800 text-[11px] text-gray-300 flex items-center gap-2">
              <Check size={14} className="text-emerald-400 shrink-0" />
              <span>
                Evenly cuts this {activeLength.toFixed(1)}s clip into {equalPartsCount} equal segments of {(activeLength / equalPartsCount).toFixed(2)}s each.
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: By Interval */}
        {activeTab === 'interval' && (
          <div className="flex flex-col gap-3.5 bg-gray-950/40 p-3 rounded-xl border border-gray-800/60">
            <label className="text-xs font-bold text-gray-200 flex items-center justify-between">
              <span>Chop by Interval Duration</span>
              <span className="text-[11px] text-cyan-400 font-mono font-bold">Every {intervalSeconds}s</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[2, 3, 5, 8].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setIntervalSeconds(sec)}
                  className={`py-2 px-2 rounded-lg border text-xs font-bold transition text-center flex flex-col items-center gap-0.5 ${
                    intervalSeconds === sec
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 ring-1 ring-cyan-400/30'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <span className="text-sm">Every {sec}s</span>
                  <span className="text-[9.5px] font-mono text-gray-400">
                    ~{Math.ceil(activeLength / sec)} clips
                  </span>
                </button>
              ))}
            </div>
            <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800 text-[11px] text-gray-300 flex items-center gap-2">
              <Clock size={14} className="text-cyan-400 shrink-0" />
              <span>
                Places a cut every {intervalSeconds} seconds, creating approximately {Math.ceil(activeLength / intervalSeconds)} clips.
              </span>
            </div>
          </div>
        )}

        {/* Preview Results Banner */}
        {previewResults && (
          <div className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 ${
            previewResults.cutPoints.length > 0
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
          }`}>
            <div className="flex items-center gap-2 font-bold">
              {previewResults.cutPoints.length > 0 ? (
                <>
                  <Check size={16} className="text-emerald-400" />
                  <span>Found {previewResults.cutPoints.length} cut point{previewResults.cutPoints.length > 1 ? 's' : ''} ({previewResults.segmentsCount} clips)</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="text-amber-400" />
                  <span>No scene cuts detected in this clip</span>
                </>
              )}
            </div>
            {previewResults.cutPoints.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {previewResults.cutPoints.map((cp, idx) => (
                  <span key={idx} className="bg-black/50 border border-emerald-600/40 text-[10px] font-mono px-1.5 py-0.5 rounded text-emerald-300">
                    Cut #{idx + 1}: {cp.toFixed(2)}s
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-[11px] text-amber-300/90 leading-tight">
                  This shot has continuous camera motion. Use one of these 1-click options to split it:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSensitivity(0.05);
                      setTimeout(handlePreviewCuts, 50);
                    }}
                    className="py-1 px-2.5 rounded-lg bg-amber-900/60 hover:bg-amber-800 border border-amber-600/50 text-[10.5px] font-bold text-amber-200 transition cursor-pointer"
                  >
                    🔍 Try Ultra Sensitivity
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('equal_parts');
                      setEqualPartsCount(2);
                    }}
                    className="py-1 px-2.5 rounded-lg bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-600/50 text-[10.5px] font-bold text-cyan-200 transition cursor-pointer"
                  >
                    ✂️ Divide into 2 Halves
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('equal_parts');
                      setEqualPartsCount(3);
                    }}
                    className="py-1 px-2.5 rounded-lg bg-purple-900/60 hover:bg-purple-800 border border-purple-600/50 text-[10.5px] font-bold text-purple-200 transition cursor-pointer"
                  >
                    ✂️ Divide into 3 Parts
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-gray-800 pt-3 gap-2">
          {activeTab === 'scene_cuts' ? (
            <button
              type="button"
              onClick={handlePreviewCuts}
              disabled={isPreviewing || isChopping}
              className="py-2.5 px-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isPreviewing ? (
                <RefreshCw size={14} className="animate-spin text-cyan-400" />
              ) : (
                <Sliders size={14} className="text-cyan-400" />
              )}
              <span>{isPreviewing ? 'Testing...' : 'Test & Preview Cuts'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-3.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isChopping || isPreviewing}
              className="py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl text-xs font-black shadow-lg shadow-cyan-900/40 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {isChopping ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Chopping...</span>
                </>
              ) : (
                <>
                  <Scissors size={14} />
                  <span>Apply Chop</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
