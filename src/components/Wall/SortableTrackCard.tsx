import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SubsonicSong } from '../../api/types';
import { usePlayerStore } from '../../store/player';
import CoverImage from '../common/CoverImage';

interface SortableTrackCardProps {
  track: SubsonicSong;
  queue: SubsonicSong[];
  onContextMenu: (e: React.MouseEvent, track: SubsonicSong) => void;
}

export default function SortableTrackCard({ track, queue, onContextMenu }: SortableTrackCardProps) {
  const { currentTrack, isPlaying, play } = usePlayerStore();
  const isCurrentTrack = currentTrack?.id === track.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`track-card ${isCurrentTrack ? 'playing' : ''} ${isDragging ? 'shadow-2xl' : ''}`}
      onClick={() => play(track, queue)}
      onContextMenu={(e) => onContextMenu(e, track)}
    >
      <div className="relative aspect-square" {...attributes} {...listeners}>
        <CoverImage
          coverArt={track.coverArt}
          size={300}
          alt={track.title}
          className="w-full h-full"
        />

        {/* Play button overlay on hover */}
        <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
          <div className="w-12 h-12 rounded-full bg-[rgb(var(--accent))] flex items-center justify-center">
            <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Sound wave animation for playing track */}
        {isCurrentTrack && isPlaying && (
          <div className="absolute bottom-2 left-2">
            <div className="sound-wave">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        {/* Drag handle indicator */}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-white/60 text-lg">⠿</div>
        </div>
      </div>

      <div className="p-3">
        <div className="text-sm font-medium truncate text-[rgb(var(--text-primary))]">
          {track.title}
        </div>
        <div className="text-xs text-[rgb(var(--text-secondary))] truncate mt-0.5">
          {track.artist}
        </div>
      </div>
    </div>
  );
}
