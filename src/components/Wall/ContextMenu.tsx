import React, { useEffect, useRef } from 'react';
import { SubsonicSong } from '../../api/types';
import { usePlaylistStore } from '../../store/playlist';
import { usePlayerStore } from '../../store/player';
import { usePlaylists } from '../../hooks/usePlaylists';

interface ContextMenuProps {
  x: number;
  y: number;
  track: SubsonicSong;
  onClose: () => void;
}

export default function ContextMenu({ x, y, track, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { playlists } = usePlaylistStore();
  const { addToQueue, play } = usePlayerStore();
  const { addSongToPlaylist } = usePlaylists();
  const { activePlaylist } = usePlaylistStore();
  const [showPlaylists, setShowPlaylists] = React.useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust position to stay in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  const getConfig = () => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    const config = getConfig();
    if (config) {
      await addSongToPlaylist({ playlistId, songId: track.id });
      onClose();
    }
  };

  const handleRemoveFromPlaylist = async () => {
    if (!activePlaylist) return;
    const config = getConfig();
    if (config) {
      const { removeSongFromPlaylist } = usePlaylistStore.getState();
      // We need the API call here
      const { updatePlaylist } = await import('../../api/subsonic');
      await updatePlaylist(config, activePlaylist.id, { removeSongIds: [track.id] });
      // Refresh
      const { fetchPlaylistTracks } = usePlaylistStore.getState();
      await fetchPlaylistTracks(config, activePlaylist.id);
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      <div className="py-1">
        <button
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 flex items-center gap-2"
          onClick={() => { play(track); onClose(); }}
        >
          <span>▶️</span> 播放此曲
        </button>
        <button
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 flex items-center gap-2"
          onClick={() => { addToQueue(track); onClose(); }}
        >
          <span>➕</span> 添加到播放队列
        </button>

        <div className="border-t border-white/5 my-1" />

        {/* Add to playlist submenu */}
        <div className="relative">
          <button
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 flex items-center justify-between"
            onClick={() => setShowPlaylists(!showPlaylists)}
          >
            <span className="flex items-center gap-2">
              <span>📋</span> 添加到歌单
            </span>
            <span className="text-[rgb(var(--text-secondary))]">›</span>
          </button>

          {showPlaylists && (
            <div className="absolute left-full top-0 ml-1 context-menu py-1">
              {playlists.map(playlist => (
                <button
                  key={playlist.id}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-white/10 whitespace-nowrap"
                  onClick={() => handleAddToPlaylist(playlist.id)}
                >
                  {playlist.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {activePlaylist && (
          <>
            <div className="border-t border-white/5 my-1" />
            <button
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-500/20 text-red-400 flex items-center gap-2"
              onClick={handleRemoveFromPlaylist}
            >
              <span>🗑️</span> 从当前歌单移除
            </button>
          </>
        )}
      </div>
    </div>
  );
}
