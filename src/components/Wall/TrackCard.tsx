import React, { memo } from 'react';
import { SubsonicSong } from '../../api/types';
import { usePlayerStore } from '../../store/player';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';

interface TrackCardProps {
  track: SubsonicSong;
  queue: SubsonicSong[];
  onContextMenu: (e: React.MouseEvent, track: SubsonicSong) => void;
}

const TrackCard = memo(function TrackCard({ track, queue, onContextMenu }: TrackCardProps) {
  const { currentTrack, isPlaying, play } = usePlayerStore();
  const isCurrentTrack = currentTrack?.id === track.id;

  return (
    <div
      className={`group relative rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-200 ${
        isCurrentTrack ? 'ring-2 ring-[rgb(var(--accent))]' : ''
      }`}
      onClick={() => play(track, queue)}
      onContextMenu={(e) => onContextMenu(e, track)}
    >
      <div className="relative aspect-square bg-gray-800">
        <CoverImage
          coverArt={track.coverArt}
          size={300}
          alt={track.title}
          className="w-full h-full"
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Icon name="play" size={20} className="text-black ml-0.5" />
            </div>
          </div>
        </div>

        {/* Playing indicator */}
        {isCurrentTrack && isPlaying && (
          <div className="absolute bottom-2 left-2">
            <div className="sound-wave">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        {/* Now playing badge */}
        {isCurrentTrack && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[rgb(var(--accent))] flex items-center justify-center">
            <Icon name="music" size={12} className="text-white" />
          </div>
        )}
      </div>

      <div className="p-2.5 bg-gray-900/90">
        <div className="text-sm font-medium truncate text-white">{track.title}</div>
        <div className="text-xs text-gray-400 truncate mt-0.5">{track.artist}</div>
      </div>
    </div>
  );
});

export default TrackCard;
