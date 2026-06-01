import React, { useState } from 'react';
import { SubsonicPlaylist, ServerConfig } from '../../api/types';
import { getCoverArtUrl } from '../../api/subsonic';

interface PlaylistItemProps {
  playlist: SubsonicPlaylist;
  isActive: boolean;
  onSelect: (playlist: SubsonicPlaylist) => void;
  onRename: (playlist: SubsonicPlaylist) => void;
  onDelete: (playlistId: string) => void;
}

export default function PlaylistItem({ playlist, isActive, onSelect, onRename, onDelete }: PlaylistItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const getConfig = (): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  };

  const coverUrl = playlist.coverArt && getConfig()
    ? getCoverArtUrl(getConfig()!, playlist.coverArt, 80)
    : null;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
        isActive
          ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
          : 'hover:bg-white/5 text-[rgb(var(--text-secondary))]'
      }`}
      onClick={() => onSelect(playlist)}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
    >
      <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-[rgb(var(--bg-card))]">
        {coverUrl ? (
          <img src={coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">🎵</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{playlist.name}</div>
        <div className="text-xs text-[rgb(var(--text-secondary))]">
          {playlist.songCount} 首
        </div>
      </div>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-50 context-menu p-1">
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onRename(playlist);
              }}
            >
              重命名
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-red-500/20 text-red-400 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDelete(playlist.id);
              }}
            >
              删除
            </button>
          </div>
        </>
      )}
    </div>
  );
}
