import React from 'react';
import { usePlayerStore } from '../../store/player';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';

interface QueueProps {
  onClose: () => void;
}

export default function Queue({ onClose }: QueueProps) {
  const { queue, queueIndex, currentTrack, play, removeFromQueue, clearQueue } = usePlayerStore();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Icon name="playlist" size={20} />
          播放队列
        </h3>
        <div className="flex items-center gap-2">
          <button
            className="text-sm text-[rgb(var(--text-secondary))] hover:text-white flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
            onClick={clearQueue}
          >
            <Icon name="trash" size={14} />
            清空
          </button>
          <button
            className="text-[rgb(var(--text-secondary))] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--text-secondary))]">
            <Icon name="playlist" size={48} className="mb-3 opacity-50" />
            <div>队列为空</div>
          </div>
        ) : (
          <div className="py-2">
            {queue.map((song, index) => (
              <div
                key={`${song.id}-${index}`}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/5 transition-colors ${
                  index === queueIndex ? 'bg-[rgb(var(--accent))]/10' : ''
                }`}
                onClick={() => play(song, queue)}
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
                  <CoverImage coverArt={song.coverArt} size={40} alt={song.title} className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate font-medium">{song.title}</div>
                  <div className="text-xs text-[rgb(var(--text-secondary))] truncate">
                    {song.artist}
                  </div>
                </div>
                {index === queueIndex && (
                  <div className="w-6 h-6 rounded-full bg-[rgb(var(--accent))] flex items-center justify-center">
                    <Icon name="play" size={12} className="text-white ml-0.5" />
                  </div>
                )}
                <button
                  className="text-[rgb(var(--text-secondary))] hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromQueue(index);
                  }}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
