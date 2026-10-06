import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Star, Plus, X } from 'lucide-react';
import { AudioItem, VideoEditorProject } from '../../types';

export interface AudioPlayerBarProps {
  playingAudioId: string | null;
  currentPlayingAudio: AudioItem | null;
  audioDuration: number;
  currentTime: number;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTogglePlay: (audio: AudioItem) => void;
  audioPlayerRef: React.RefObject<HTMLAudioElement | null>;
  formatTime: (sec: number) => string;
  activeBucketName: string | null;
  playPrevTrack: () => void;
  playNextTrack: () => void;
  isMuted: boolean;
  previewVolume: number;
  handleToggleMute: () => void;
  handleVolumeChange: (vol: number) => void;
  currentFolderId: string | null;
  activeProject: VideoEditorProject | null;
  handleToggleStarForProject: (audio: AudioItem, e: React.MouseEvent) => void;
  handleToggleStar: (audio: AudioItem, e?: React.MouseEvent) => void;
  isAudioStarredForProject: (audio: AudioItem) => boolean;
  isAudioStarred: (audio: AudioItem) => boolean;
  handleInsertTrackAction: (audio: AudioItem) => void;
  setPlayingAudioId: (id: string | null) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  playingAudioId,
  currentPlayingAudio,
  audioDuration,
  currentTime,
  handleSeek,
  handleTogglePlay,
  audioPlayerRef,
  formatTime,
  activeBucketName,
  playPrevTrack,
  playNextTrack,
  isMuted,
  previewVolume,
  handleToggleMute,
  handleVolumeChange,
  currentFolderId,
  activeProject,
  handleToggleStarForProject,
  handleToggleStar,
  isAudioStarredForProject,
  isAudioStarred,
  handleInsertTrackAction,
  setPlayingAudioId
}) => {
  if (!playingAudioId || !currentPlayingAudio) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-900/98 border-t border-pink-500/50 px-3 sm:px-6 py-2 sm:py-2.5 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 z-30 animate-in slide-in-from-bottom-2">
      {/* Top Scrubber Bar (Visible across Mobile and Desktop) */}
      <div className="w-full flex items-center gap-2 text-[10px] font-mono text-gray-400">
        <span className="w-8 text-right text-pink-400 font-bold shrink-0">{formatTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={audioDuration || currentPlayingAudio.duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 accent-pink-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
        />
        <span className="w-8 text-left text-gray-400 shrink-0">{formatTime(audioDuration || currentPlayingAudio.duration || 0)}</span>
      </div>

      {/* Main Controls Row */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Track metadata */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => handleTogglePlay(currentPlayingAudio)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center shrink-0 shadow-md cursor-pointer transition active:scale-95"
            title={audioPlayerRef.current?.paused ? "Play" : "Pause"}
          >
            {audioPlayerRef.current?.paused ? <Play size={13} className="ml-0.5 fill-current" /> : <Pause size={13} />}
          </button>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate">
              {currentPlayingAudio.name}
            </h4>
            <div className="flex items-center gap-1.5 text-[9px] text-pink-400/90 truncate font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>•</span>
              <span>{activeBucketName ? `⭐ ${activeBucketName}` : 'Audio Library'}</span>
            </div>
          </div>
        </div>

        {/* Controls: Prev, Next, Repeat, Volume, Star, Use, Close - Strict zero overlap on Android */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={playPrevTrack}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white transition cursor-pointer active:scale-95"
            title="Previous track"
          >
            <SkipBack size={13} />
          </button>
          <button
            type="button"
            onClick={playNextTrack}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white transition cursor-pointer active:scale-95"
            title="Next track"
          >
            <SkipForward size={13} />
          </button>

          {/* Volume Slider (hidden on extra small screens) */}
          <div className="hidden sm:flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-1 text-gray-400 hover:text-white cursor-pointer"
            >
              {isMuted || previewVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : previewVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-14 accent-pink-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
              title="Preview Volume"
            />
          </div>

          {/* Star Button */}
          <button
            type="button"
            onClick={(e) => {
              if (currentFolderId === '__starred__' && activeProject) {
                handleToggleStarForProject(currentPlayingAudio, e);
              } else {
                handleToggleStar(currentPlayingAudio, e);
              }
            }}
            className={`p-1 sm:p-1.5 rounded-lg transition cursor-pointer active:scale-95 ${
              (currentFolderId === '__starred__' && activeProject)
                ? (isAudioStarredForProject(currentPlayingAudio) ? 'text-amber-400 bg-amber-400/20 ring-1 ring-amber-400/40' : 'text-gray-400 hover:text-amber-300')
                : (isAudioStarred(currentPlayingAudio) ? 'text-amber-400 bg-amber-400/10' : 'text-gray-400 hover:text-amber-300')
            }`}
            title={
              (currentFolderId === '__starred__' && activeProject)
                ? (isAudioStarredForProject(currentPlayingAudio) ? `Starred for project "${activeProject.name}" (M1-M4). Click to unstar` : `Star for project "${activeProject.name}" (M1-M4)`)
                : `Star for ${activeBucketName}`
            }
          >
            <Star 
              size={13} 
              className={
                (currentFolderId === '__starred__' && activeProject)
                  ? (isAudioStarredForProject(currentPlayingAudio) ? "fill-amber-400 text-amber-400" : "")
                  : (isAudioStarred(currentPlayingAudio) ? "fill-amber-400 text-amber-400" : "")
              } 
            />
          </button>

          {/* Insert inside the music player - Always visible & prominent on Android & Desktop */}
          <button
            type="button"
            onClick={() => handleInsertTrackAction(currentPlayingAudio)}
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs sm:text-sm font-black transition active:scale-95 cursor-pointer shadow-lg shadow-pink-600/40 flex items-center gap-1.5 shrink-0 border border-pink-400/40"
            title="Insert this track into the video timeline"
          >
            <Plus size={15} className="stroke-[3]" />
            <span>Insert Track</span>
          </button>

          {/* Close Dock */}
          <button
            type="button"
            onClick={() => {
              if (audioPlayerRef.current) audioPlayerRef.current.pause();
              setPlayingAudioId(null);
            }}
            className="p-1 sm:p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer active:scale-95 ml-0.5"
            title="Close player dock"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
