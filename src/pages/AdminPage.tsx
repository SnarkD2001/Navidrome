import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SubsonicPlaylist, ServerConfig } from '../api/types';
import { usePlaylistStore } from '../store/playlist';
import { usePlaylists } from '../hooks/usePlaylists';
import Icon from '../components/common/Icon';

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

interface AdminPageProps {
  onBack: () => void;
  onLogout: () => void;
}

type AdminTab = 'playlists' | 'wallpaper' | 'about';

export default function AdminPage({ onBack, onLogout }: AdminPageProps) {
  const { playlists } = usePlaylistStore();
  const { createNewPlaylist, renamePlaylist, removePlaylist } = usePlaylists();
  
  const [activeTab, setActiveTab] = useState<AdminTab>('playlists');
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState<SubsonicPlaylist | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getConfig = useCallback((): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  }, []);

  const config = getConfig();

  useEffect(() => {
    loadBgFromDB().then(setCustomBg).catch(console.error);
  }, []);

  const showSaveMessage = (msg: string) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    if (!config) return;
    
    try {
      await createNewPlaylist({ name: newPlaylistName.trim() });
      setNewPlaylistName('');
      setShowCreateDialog(false);
      showSaveMessage('歌单创建成功');
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  };

  const handleRenamePlaylist = async () => {
    if (!editingPlaylist || !editName.trim()) return;
    if (!config) return;
    
    try {
      await renamePlaylist({
        playlistId: editingPlaylist.id,
        name: editName.trim(),
      });
      setEditingPlaylist(null);
      showSaveMessage('歌单重命名成功');
    } catch (err) {
      console.error('Failed to rename playlist:', err);
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!config) return;
    
    try {
      await removePlaylist(playlistId);
      setDeleteConfirm(null);
      showSaveMessage('歌单已删除');
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
        showSaveMessage('壁纸设置成功');
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
      showSaveMessage('壁纸已移除');
    } catch (err) {
      console.error('Failed to remove:', err);
    }
  };

  const sidebarItems = [
    { id: 'playlists' as AdminTab, icon: 'playlist', label: '歌单管理' },
    { id: 'wallpaper' as AdminTab, icon: 'image', label: '壁纸设置' },
    { id: 'about' as AdminTab, icon: 'music', label: '关于' },
  ];

  return (
    <div className="h-screen w-screen flex bg-gray-900">
      {/* 侧边栏 */}
      <div className="w-64 bg-gray-800/50 border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Icon name="settings" size={20} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">后台管理</h1>
              <p className="text-xs text-gray-500">Navidrome Player</p>
            </div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon name={item.icon} size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* 底部操作 */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all duration-200"
            onClick={onBack}
          >
            <Icon name="chevron-up" size={18} className="rotate-[-90deg]" />
            <span className="text-sm font-medium">返回主页</span>
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
            onClick={onLogout}
          >
            <Icon name="logout" size={18} />
            <span className="text-sm font-medium">退出登录</span>
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部栏 */}
        <div className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-gray-800/30">
          <h2 className="text-lg font-semibold text-white">
            {sidebarItems.find(i => i.id === activeTab)?.label}
          </h2>
          
          {/* 保存提示 */}
          {saveMessage && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm animate-fade-in">
              <Icon name="check" size={14} />
              {saveMessage}
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{config?.username}</span>
            <span>·</span>
            <span>{config?.name}</span>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'playlists' && (
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">歌单管理</h3>
                  <p className="text-sm text-gray-400">创建和管理你的音乐歌单</p>
                </div>
                <button
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl transition-all duration-200 text-white text-sm font-medium hover:scale-105 active:scale-95"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Icon name="plus" size={16} />
                  新建歌单
                </button>
              </div>

              <div className="space-y-3">
                {playlists.length === 0 ? (
                  <div className="text-center py-20 bg-gray-800/50 rounded-2xl border border-white/5">
                    <Icon name="playlist" size={64} className="mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-500 text-lg mb-2">暂无歌单</p>
                    <p className="text-gray-600 text-sm mb-6">点击上方按钮创建你的第一个歌单</p>
                    <button
                      className="px-6 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl transition-all duration-200 text-sm"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      开始创建
                    </button>
                  </div>
                ) : (
                  playlists.map((playlist: SubsonicPlaylist) => (
                    <div
                      key={playlist.id}
                      className="relative group bg-gray-800/50 hover:bg-gray-800/70 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-200"
                    >
                      <div className="flex items-center gap-4 p-5">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <Icon name="music" size={24} className="text-blue-400" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {editingPlaylist?.id === playlist.id ? (
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="flex-1 px-4 py-2 bg-gray-700/50 rounded-lg border border-white/10 focus:outline-none focus:border-blue-400 text-white text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenamePlaylist();
                                  if (e.key === 'Escape') setEditingPlaylist(null);
                                }}
                              />
                              <button
                                className="p-2 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors"
                                onClick={handleRenamePlaylist}
                              >
                                <Icon name="check" size={16} />
                              </button>
                              <button
                                className="p-2 hover:bg-gray-500/20 text-gray-400 rounded-lg transition-colors"
                                onClick={() => setEditingPlaylist(null)}
                              >
                                <Icon name="x" size={16} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-base font-semibold text-white">{playlist.name}</h4>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                <span>{playlist.songCount} 首歌曲</span>
                                <span>·</span>
                                <span>{playlist.duration ? `${Math.round(playlist.duration / 60)} 分钟` : '未知时长'}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {editingPlaylist?.id !== playlist.id && (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-2.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                              onClick={() => {
                                setEditingPlaylist(playlist);
                                setEditName(playlist.name);
                              }}
                              title="重命名"
                            >
                              <Icon name="edit" size={16} />
                            </button>
                            <button
                              className="p-2.5 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                              onClick={() => setDeleteConfirm(playlist.id)}
                              title="删除"
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      {deleteConfirm === playlist.id && (
                        <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm rounded-xl flex items-center justify-center gap-4 z-10">
                          <p className="text-gray-300">确定要删除歌单 <span className="font-semibold text-white">"{playlist.name}"</span> 吗？</p>
                          <button
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm font-medium"
                            onClick={() => handleDeletePlaylist(playlist.id)}
                          >
                            确认删除
                          </button>
                          <button
                            className="px-4 py-2 hover:bg-white/10 text-gray-400 rounded-lg transition-colors text-sm"
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
          )}

          {activeTab === 'wallpaper' && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-1">壁纸设置</h3>
                <p className="text-sm text-gray-400">自定义背景图片，让界面更个性化</p>
              </div>

              <div className="space-y-8">
                {/* 上传区域 */}
                <div className="bg-gray-800/50 rounded-2xl border border-white/5 p-8">
                  <h4 className="text-lg font-semibold text-white mb-4">上传壁纸</h4>
                  <div
                    className="border-2 border-dashed border-white/10 hover:border-blue-500/50 rounded-xl p-12 text-center cursor-pointer transition-all duration-200 hover:bg-blue-500/5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icon name="image" size={48} className="mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400 mb-2">点击选择图片或拖拽到此处</p>
                    <p className="text-xs text-gray-600">支持 JPG、PNG、GIF、WebP 格式，无大小限制</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBgUpload}
                  />
                </div>

                {/* 当前壁纸预览 */}
                <div className="bg-gray-800/50 rounded-2xl border border-white/5 p-8">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-white">当前壁纸</h4>
                    {customBg && (
                      <button
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        onClick={handleRemoveBg}
                      >
                        <Icon name="trash" size={14} />
                        移除壁纸
                      </button>
                    )}
                  </div>
                  
                  <div className="aspect-video rounded-xl overflow-hidden bg-gray-700/50 border border-white/5">
                    {customBg ? (
                      <img
                        src={customBg}
                        alt="当前壁纸"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <Icon name="image" size={64} className="text-gray-700 mb-3" />
                        <p className="text-gray-500 text-lg">使用默认背景</p>
                        <p className="text-gray-600 text-sm mt-1">上传图片自定义你的壁纸</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 预设渐变 */}
                <div className="bg-gray-800/50 rounded-2xl border border-white/5 p-8">
                  <h4 className="text-lg font-semibold text-white mb-4">预设渐变</h4>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { name: '深空', gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
                      { name: '深海', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' },
                      { name: '暗夜', gradient: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)' },
                      { name: '星空', gradient: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 100%)' },
                    ].map((preset, index) => (
                      <button
                        key={index}
                        className="group relative h-24 rounded-xl border-2 border-transparent hover:border-blue-400 transition-all duration-200 overflow-hidden"
                        style={{ background: preset.gradient }}
                      >
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            {preset.name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-1">关于</h3>
                <p className="text-sm text-gray-400">应用信息和系统状态</p>
              </div>

              <div className="space-y-6">
                {/* 应用信息 */}
                <div className="bg-gray-800/50 rounded-2xl border border-white/5 p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <Icon name="music" size={32} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-white">Navidrome Player</h4>
                      <p className="text-gray-400">一个现代化的 Navidrome 音乐播放器</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-700/50 rounded-xl p-4">
                      <p className="text-sm text-gray-400 mb-1">版本</p>
                      <p className="text-white font-semibold">1.0.0</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-xl p-4">
                      <p className="text-sm text-gray-400 mb-1">技术栈</p>
                      <p className="text-white font-semibold">React + Canvas</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-xl p-4">
                      <p className="text-sm text-gray-400 mb-1">歌单数量</p>
                      <p className="text-white font-semibold">{playlists.length}</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-xl p-4">
                      <p className="text-sm text-gray-400 mb-1">自定义壁纸</p>
                      <p className="text-white font-semibold">{customBg ? '已设置' : '未设置'}</p>
                    </div>
                  </div>
                </div>

                {/* 服务器信息 */}
                <div className="bg-gray-800/50 rounded-2xl border border-white/5 p-8">
                  <h4 className="text-lg font-semibold text-white mb-4">服务器信息</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-gray-400">服务器地址</span>
                      <span className="text-white font-mono text-sm">{config?.url}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-gray-400">用户名</span>
                      <span className="text-white">{config?.username}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-gray-400">服务器名称</span>
                      <span className="text-white">{config?.name}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-400">API 版本</span>
                      <span className="text-white">Subsonic 1.16.1</span>
                    </div>
                  </div>
                </div>

                {/* 功能特性 */}
                <div className="bg-gray-800/50 rounded-2xl border border-white/5 p-8">
                  <h4 className="text-lg font-semibold text-white mb-4">功能特性</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      'Canvas 2D 高性能渲染',
                      'macOS Dock 放大效果',
                      '自定义背景壁纸',
                      '歌单管理',
                      'Poisson 随机分布',
                      '平滑动画过渡',
                      '毛玻璃 UI 效果',
                      '响应式布局',
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-gray-300">
                        <Icon name="check" size={14} className="text-green-400" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 新建歌单对话框 */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-96 bg-gray-800/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl p-8">
            <h3 className="text-xl font-bold text-white mb-6">新建歌单</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="输入歌单名称"
              className="w-full px-4 py-3 bg-gray-700/50 rounded-xl border border-white/10 focus:outline-none focus:border-blue-400 text-white placeholder-gray-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreatePlaylist();
                if (e.key === 'Escape') setShowCreateDialog(false);
              }}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                className="px-5 py-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                onClick={() => setShowCreateDialog(false)}
              >
                取消
              </button>
              <button
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors text-white font-medium"
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
