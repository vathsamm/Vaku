import React from 'react';
import { AudioDashboard } from './AudioDashboard';
import { DB, AudioItem, VideoEditorProject } from '../types';

export interface AudioLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB | null>>;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  masterBucketFid?: string;
  masterBucketName?: string;
  selectedAudioId?: string;
  onSelectAudio?: (audio: AudioItem) => void;
  currentUserEmail?: string;
  isAdmin?: boolean;
  usersList?: any[];
  activeProject?: VideoEditorProject | null;
  onSaveProject?: (project: VideoEditorProject) => void;
}

export const AudioLibraryModal: React.FC<AudioLibraryModalProps> = (props) => {
  return <AudioDashboard {...props} isModal={true} />;
};

export default AudioLibraryModal;
