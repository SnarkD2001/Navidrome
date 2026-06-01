import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SubsonicPlaylist, ServerConfig } from '../api/types';
import { usePlaylistStore } from '../store/playlist';
import { usePlaylists } from '../hooks/usePlaylists';
import Icon from '../components/common/Icon';

interface SettingsPageProps {
  onClose: () => void;
  onLogout: () => void;
}

// IndexedDB
const DB_NAME = 'navidrome-player';
const STORE_NAME = 'backgrounds';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveBgToDB(imageData: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(imageData, 'custom-bg');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function loadBgFromDB(): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('custom-bg');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function removeBgFromDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete('custom-bg');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export default function SettingsPage({ onClose, onLogout }: SettingsPageProps) {
  const { playlists } = usePlaylistStore();
  const { createNewPlaylist, renamePlaylist, removePlaylist } = usePlaylists();
  
  const [activeTab, setActiveTab] = useState<'playlists' | 'wallpaper'>('playlists');
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState<SubsonicPlaylist | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getConfig = useCallback((): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  }, []);

  useEffect(() => {
    loadBgFromDB().then(setCustomBg).catch(console.error);
  }, []);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const config = getConfig();
    if (!config) return;
    
    try {
      await createNewPlaylist({ name: newPlaylistName.trim() });
      setNewPlaylistName('');
      setShowCreateDialog(false);
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  };

  const handleRenamePlaylist = async () => {
    if (!editingPlaylist || !editName.trim()) return;
    const config = getConfig();
    if (!config) return;
    
    try {
      await renamePlaylist({
        playlistId: editingPlaylist.id,
        name: editName.trim(),
      });
      setEditingPlaylist(null);
    } catch (err) {
      console.error('Failed to rename playlist:', err);
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    const config = getConfig();
    if (!config) return;
    
    try {
      await removePlaylist(playlistId);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setCustomBg(dataUrl);
      try {
        await saveBgToDB(dataUrl);
      } catch (err) {
        console.error('Failed to save:', err);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveBg = async () => {
    setCustomBg(null);
    try {
      await removeBgFromDB();
    } catch (err) {
      console.error('Failed to remove:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] bg-gray-800/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h1 className="text-xl font-bold text-white">设置</h1>
          <button
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white"
            onClick={onClose}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-white/10">
          <button
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'playlists'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('playlists')}
          >
            <div className="flex items-center justify-center gap-2">
              <Icon name="playlist" size={16} />
              歌单管理
            </div>
          </button>
          <button
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'wallpaper'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('wallpaper')}
          >
            <div className="flex items-center justify-center gap-2">
              <Icon name="image" size={16} />
              壁纸设置
            </div>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'playlists' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">管理你的音乐歌单</p>
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl transition-all duration-200 text-sm"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Icon name="plus" size={14} />
                  新建歌单
                </button>
              </div>

              <div className="space-y-2">
                {playlists.length === 0 ? (
                  <div className="text-center py-12">
                    <Icon name="playlist" size={48} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-500">暂无歌单</p>
                    <p className="text-xs text-gray-600 mt-1">点击上方按钮创建第一个歌单</p>
                  </div>
                ) : (
                  playlists.map((playlist: SubsonicPlaylist) => (
                    <div
                      key={playlist.id}
                      className="relative flex items-center gap-4 p-4 bg-gray-700/50 rounded-xl hover:bg-gray-700/70 transition-colors group"
                    >
                      <div className="w-12 h-12 rounded-lg bg-gray-600/50 flex items-center justify-center flex-shrink-0">
                        <Icon name="music" size={20} className="text-gray-400" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {editingPlaylist?.id === playlist.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 px-3 py-1.5 bg-gray-600/50 rounded-lg border border-white/10 focus:outline-none focus:border-blue-400 text-white text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenamePlaylist();
                                if (e.key === 'Escape') setEditingPlaylist(null);
                              }}
                            />
                            <button
                              className="p-1.5 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors"
                              onClick={handleRenamePlaylist}
                            >
                              <Icon name="check" size={14} />
                            </button>
                            <button
                              className="p-1.5 hover:bg-gray-500/20 text-gray-400 rounded-lg transition-colors"
                              onClick={() => setEditingPlaylist(null)}
                            >
                              <Icon name="x" size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-white truncate">{playlist.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {playlist.songCount} 首歌曲
                            </div>
                          </>
                        )}
                      </div>

                      {editingPlaylist?.id !== playlist.id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                            onClick={() => {
                              setEditingPlaylist(playlist);
                              setEditName(playlist.name);
                            }}
                            title="重命名"
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                            onClick={() => setDeleteConfirm(playlist.id)}
                            title="删除"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      )}

                      {deleteConfirm === playlist.id && (
                        <div className="absolute inset-0 bg-gray-800/95 backdrop-blur-sm rounded-xl flex items-center justify-center gap-3 z-10">
                          <span className="text-sm text-gray-300">确定删除 "{playlist.name}"？</span>
                          <button
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
                            onClick={() => handleDeletePlaylist(playlist.id)}
                          >
                            删除
                          </button>
                          <button
                            className="px-3 py-1.5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors text-sm"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-400 mb-4">自定义背景图片，让界面更个性化</p>
                
                <div className="flex items-center gap-3">
                  <button
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl transition-all duration-200 border-2 border-dashed border-blue-500/30 hover:border-blue-500/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icon name="image" size={20} />
                    <span className="text-sm font-medium">选择图片上传</span>
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 mt-2 text-center">
                  支持 JPG、PNG、GIF、WebP 格式，无大小限制
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBgUpload}
              />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-300">当前壁纸</h3>
                  {customBg && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      onClick={handleRemoveBg}
                    >
                      <Icon name="trash" size={12} />
                      移除壁纸
                    </button>
                  )}
                </div>
                
                <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-700/50 border border-white/5">
                  {customBg ? (
                    <img
                      src={customBg}
                      alt="当前壁纸"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <Icon name="image" size={40} className="text-gray-600 mb-2" />
                      <p className="text-sm text-gray-500">使用默认背景</p>
                      <p className="text-xs text-gray-600 mt-1">上传图片自定义壁纸</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-gray-800/50">
          <button
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
            onClick={onLogout}
          >
            <Icon name="logout" size={14} />
            退出登录
          </button>
          <button
            className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl transition-all duration-200 text-white text-sm"
            onClick={onClose}
          >
            完成
          </button>
        </div>
      </div>

      {/* 新建歌单对话框 */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-80 bg-gray-800/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">新建歌单</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="输入歌单名称"
              className="w-full px-4 py-3 bg-gray-700/50 rounded-xl border border-white/10 focus:outline-none focus:border-blue-400 text-white placeholder-gray-500 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreatePlaylist();
                if (e.key === 'Escape') setShowCreateDialog(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                onClick={() => setShowCreateDialog(false)}
              >
                取消
              </button>
              <button
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors text-white"
                onClick={handleCreatePlaylist}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
