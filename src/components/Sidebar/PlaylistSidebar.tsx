import React, { useState } from 'react';
import { SubsonicPlaylist, ServerConfig } from '../../api/types';
import { usePlaylistStore } from '../../store/playlist';
import { useWallStore } from '../../store/wall';
import { usePlaylists } from '../../hooks/usePlaylists';
import { getCoverArtUrl } from '../../api/subsonic';
import Icon from '../common/Icon';

interface PlaylistItemProps {
  playlist: SubsonicPlaylist;
  isActive: boolean;
  onSelect: (playlist: SubsonicPlaylist) => void;
  onRename: (playlist: SubsonicPlaylist) => void;
  onDelete: (playlistId: string) => void;
}

const PlaylistItem: React.FC<PlaylistItemProps> = ({ playlist, isActive, onSelect, onRename, onDelete }) => {
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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
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
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[rgb(var(--bg-card))] shadow-md">
        {coverUrl ? (
          <img src={coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="music" size={18} className="text-[rgb(var(--text-secondary))]" />
          </div>
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
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 rounded-lg flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onRename(playlist);
              }}
            >
              <Icon name="edit" size={14} />
              重命名
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-red-500/20 text-red-400 rounded-lg flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDelete(playlist.id);
              }}
            >
              <Icon name="trash" size={14} />
              删除
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default function PlaylistSidebar() {
  const { playlists, activePlaylist, viewMode } = usePlaylistStore();
  const { fetchPlaylistTracks, createNewPlaylist, renamePlaylist, removePlaylist } = usePlaylists();
  const { setSource, setSearchQuery, source, searchQuery } = useWallStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [renamingPlaylist, setRenamingPlaylist] = useState<SubsonicPlaylist | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [searchValue, setSearchValue] = useState('');

  const getConfig = (): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  };

  const handleSelectPlaylist = (playlist: SubsonicPlaylist) => {
    const config = getConfig();
    if (config) {
      fetchPlaylistTracks(config, playlist.id);
      setSource('playlist');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const config = getConfig();
    if (config) {
      await createNewPlaylist({ name: newPlaylistName.trim() });
      setNewPlaylistName('');
      setShowCreateDialog(false);
    }
  };

  const handleRename = async () => {
    if (!renamingPlaylist || !renameValue.trim()) return;
    const config = getConfig();
    if (config) {
      await renamePlaylist({
        playlistId: renamingPlaylist.id,
        name: renameValue.trim(),
      });
      setRenamingPlaylist(null);
    }
  };

  const handleDelete = async (playlistId: string) => {
    const config = getConfig();
    if (config) {
      await removePlaylist(playlistId);
    }
  };

  const handleSearch = () => {
    const q = searchValue.trim();
    if (!q) return;
    setSearchQuery(q);
    setSource('search');
    usePlaylistStore.getState().setViewMode('all-tracks');
  };

  return (
    <div className="sidebar flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Icon name="music" size={24} className="text-[rgb(var(--accent))]" />
          <h1 className="text-xl font-bold">Navidrome</h1>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="relative">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--text-secondary))]/50 pointer-events-none" />
          <input
            data-search-input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
              // 阻止 Space 等冒泡到全局快捷键
              e.stopPropagation();
            }}
            placeholder="搜索曲目..."
            className="w-full pl-9 pr-14 py-2 text-sm bg-white/5 rounded-xl border border-white/5
                       focus:outline-none focus:border-[rgb(var(--accent))]/50 focus:bg-white/8
                       placeholder:text-[rgb(var(--text-secondary))]/30 transition-all"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[rgb(var(--text-secondary))]/40
                          bg-white/5 px-1.5 py-0.5 rounded border border-white/5 pointer-events-none select-none">
            ⌘K
          </kbd>
        </div>
        {/* 搜索结果提示 */}
        {source === 'search' && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-[rgb(var(--accent))] truncate">
              🔍 {searchQuery}
            </span>
            <button
              className="text-xs text-[rgb(var(--text-secondary))] hover:text-white transition-colors"
              onClick={() => {
                setSearchValue('');
                setSource('all');
                usePlaylistStore.getState().setViewMode('all-tracks');
              }}
            >
              清除
            </button>
          </div>
        )}
      </div>

      {/* Fixed entries */}
      <div className="px-3 py-3 border-b border-white/5 space-y-1">
        <button
          className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 transition-colors ${
            viewMode === 'all-tracks'
              ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
              : 'hover:bg-white/5 text-[rgb(var(--text-secondary))]'
          }`}
          onClick={() => {
            usePlaylistStore.getState().setViewMode('all-tracks');
            setSource('all');
          }}
        >
          <Icon name="grid" size={18} />
          全部曲目
        </button>
        <button
          className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 transition-colors ${
            viewMode === 'recent'
              ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
              : 'hover:bg-white/5 text-[rgb(var(--text-secondary))]'
          }`}
          onClick={() => {
            usePlaylistStore.getState().setViewMode('recent');
            setSource('recent');
          }}
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2"/>
            <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          最近播放
        </button>
      </div>

      {/* Playlists header */}
      <div className="px-5 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-[rgb(var(--text-secondary))] tracking-wider">
          歌单
        </span>
        <button
          className="text-[rgb(var(--accent))] hover:text-[rgb(var(--accent-hover))] flex items-center gap-1 text-sm"
          onClick={() => setShowCreateDialog(true)}
        >
          <Icon name="plus" size={16} />
          新建
        </button>
      </div>

      {/* Playlists list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {playlists.map(playlist => (
          <PlaylistItem
            key={playlist.id}
            playlist={playlist}
            isActive={activePlaylist?.id === playlist.id}
            onSelect={handleSelectPlaylist}
            onRename={(p) => {
              setRenamingPlaylist(p);
              setRenameValue(p.name);
            }}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Create playlist dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl p-6 w-80 shadow-2xl border border-white/10">
            <h3 className="text-lg font-semibold mb-4">新建歌单</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="歌单名称"
              className="w-full px-4 py-3 bg-[rgb(var(--bg-card))] rounded-xl border border-white/10 focus:outline-none focus:border-[rgb(var(--accent))] transition-colors"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 text-sm text-[rgb(var(--text-secondary))] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                onClick={() => setShowCreateDialog(false)}
              >
                取消
              </button>
              <button
                className="px-4 py-2 text-sm bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accent-hover))] rounded-lg transition-colors"
                onClick={handleCreatePlaylist}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename dialog */}
      {renamingPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl p-6 w-80 shadow-2xl border border-white/10">
            <h3 className="text-lg font-semibold mb-4">重命名歌单</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-4 py-3 bg-[rgb(var(--bg-card))] rounded-xl border border-white/10 focus:outline-none focus:border-[rgb(var(--accent))] transition-colors"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 text-sm text-[rgb(var(--text-secondary))] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                onClick={() => setRenamingPlaylist(null)}
              >
                取消
              </button>
              <button
                className="px-4 py-2 text-sm bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accent-hover))] rounded-lg transition-colors"
                onClick={handleRename}
              >
                重命名
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
