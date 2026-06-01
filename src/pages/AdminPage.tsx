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

type AdminTab = 'playlists' | 'upload' | 'wallpaper' | 'settings' | 'about';

const API_URL = 'http://localhost:3001';

export default function AdminPage({ onBack, onLogout }: AdminPageProps) {
  const { playlists } = usePlaylistStore();
  const { createNewPlaylist, renamePlaylist, removePlaylist } = usePlaylists();
  
  const [activeTab, setActiveTab] = useState<AdminTab>('upload');
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState<SubsonicPlaylist | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // 上传相关
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  
  // 后端配置
  const [backendConfig, setBackendConfig] = useState({
    musicFolder: '',
    navidromeUrl: '',
    navidromeUser: '',
    navidromeToken: '',
    navidromeSalt: '',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const getConfig = useCallback((): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  }, []);

  const config = getConfig();

  useEffect(() => {
    loadBgFromDB().then(setCustomBg).catch(console.error);
    loadBackendConfig();
    loadMusicList();
  }, []);

  const showSaveMessage = (msg: string) => {
    setSaveMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setSaveMessage(null);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // 加载后端配置
  const loadBackendConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setBackendConfig(data);
      }
    } catch (err) {
      console.error('Failed to load backend config:', err);
    }
  };

  // 保存后端配置
  const saveBackendConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendConfig),
      });
      if (res.ok) {
        showSaveMessage('配置已保存');
      }
    } catch (err) {
      showError('保存配置失败');
    }
  };

  // 加载音乐列表
  const loadMusicList = async () => {
    try {
      const res = await fetch(`${API_URL}/api/music`);
      if (res.ok) {
        const data = await res.json();
        setUploadedFiles(data);
      }
    } catch (err) {
      console.error('Failed to load music list:', err);
    }
  };

  // 上传音乐文件
  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        showSaveMessage(`成功上传 ${data.count} 个文件`);
        loadMusicList();
      } else {
        const err = await res.json();
        showError(err.error || '上传失败');
      }
    } catch (err) {
      showError('上传失败，请检查后端服务是否运行');
    } finally {
      setUploading(false);
      setUploadProgress(100);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 删除音乐文件
  const handleDeleteMusic = async (filename: string) => {
    try {
      const res = await fetch(`${API_URL}/api/music/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showSaveMessage('文件已删除');
        loadMusicList();
      }
    } catch (err) {
      showError('删除失败');
    }
  };

  // 触发扫描
  const handleScan = async () => {
    try {
      const res = await fetch(`${API_URL}/api/scan`, {
        method: 'POST',
      });
      if (res.ok) {
        showSaveMessage('Navidrome 扫描已触发');
      } else {
        const err = await res.json();
        showError(err.error || '扫描失败');
      }
    } catch (err) {
      showError('扫描失败，请检查 Navidrome 配置');
    }
  };

  // 歌单操作
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    if (!config) return;
    
    try {
      await createNewPlaylist({ name: newPlaylistName.trim() });
      setNewPlaylistName('');
      setShowCreateDialog(false);
      showSaveMessage('歌单创建成功');
    } catch (err) {
      showError('创建歌单失败');
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
      showError('重命名失败');
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!config) return;
    
    try {
      await removePlaylist(playlistId);
      setDeleteConfirm(null);
      showSaveMessage('歌单已删除');
    } catch (err) {
      showError('删除歌单失败');
    }
  };

  // 壁纸操作
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
        showError('壁纸保存失败');
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
      showError('移除壁纸失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const sidebarItems = [
    { id: 'upload' as AdminTab, icon: 'music', label: '音乐上传' },
    { id: 'playlists' as AdminTab, icon: 'playlist', label: '歌单管理' },
    { id: 'wallpaper' as AdminTab, icon: 'image', label: '壁纸设置' },
    { id: 'settings' as AdminTab, icon: 'gear', label: '服务器配置' },
    { id: 'about' as AdminTab, icon: 'heart', label: '关于' },
  ];

  return (
    <div className="h-screen w-screen flex bg-[#0f0f1a]">
      {/* 侧边栏 */}
      <div className="w-64 bg-[#1a1f2e]/80 border-r border-white/[0.06] flex flex-col">
        <div className="p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Icon name="settings" size={20} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">后台管理</h1>
              <p className="text-xs text-gray-500">Navidrome</p>
            </div>
          </div>
        </div>

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

        <div className="p-4 border-t border-white/[0.06] space-y-2">
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
        <div className="h-16 px-8 flex items-center justify-between border-b border-white/[0.06] bg-[#1a1f2e]/30">
          <h2 className="text-lg font-semibold text-white">
            {sidebarItems.find(i => i.id === activeTab)?.label}
          </h2>
          
          <div className="flex items-center gap-3">
            {saveMessage && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm">
                <Icon name="check" size={14} />
                {saveMessage}
              </div>
            )}
            {errorMessage && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">
                <Icon name="x" size={14} />
                {errorMessage}
              </div>
            )}
            <span className="text-sm text-gray-500">{config?.username}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {/* 音乐上传 */}
          {activeTab === 'upload' && (
            <div className="max-w-4xl">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-1">音乐上传</h3>
                <p className="text-sm text-gray-400">上传音乐文件到服务器，自动同步到 Navidrome</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* 上传区域 */}
                <div className="bg-[#1a1f2e]/50 rounded-2xl border border-white/[0.06] p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">上传文件</h4>
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                      uploading 
                        ? 'border-blue-500/50 bg-blue-500/5' 
                        : 'border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5'
                    }`}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <div>
                        <div className="w-12 h-12 mx-auto mb-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-blue-400">上传中...</p>
                      </div>
                    ) : (
                      <>
                        <Icon name="music" size={48} className="mx-auto mb-3 text-gray-600" />
                        <p className="text-gray-400 mb-1">点击选择音乐文件</p>
                        <p className="text-xs text-gray-600">支持 MP3, FLAC, WAV, OGG, M4A, AAC, WMA</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.flac,.wav,.ogg,.m4a,.aac,.wma"
                    multiple
                    className="hidden"
                    onChange={handleMusicUpload}
                  />
                  
                  <button
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl transition-all duration-200"
                    onClick={handleScan}
                  >
                    <Icon name="search" size={16} />
                    触发 Navidrome 扫描
                  </button>
                </div>

                {/* 文件统计 */}
                <div className="bg-[#1a1f2e]/50 rounded-2xl border border-white/[0.06] p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">文件统计</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0f0f1a] rounded-xl p-4">
                      <p className="text-sm text-gray-400 mb-1">文件数量</p>
                      <p className="text-3xl font-bold text-white">{uploadedFiles.length}</p>
                    </div>
                    <div className="bg-[#0f0f1a] rounded-xl p-4">
                      <p className="text-sm text-gray-400 mb-1">存储路径</p>
                      <p className="text-sm text-white truncate">{backendConfig.musicFolder || '未配置'}</p>
                    </div>
                  </div>
                  
                  {!backendConfig.musicFolder && (
                    <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <p className="text-sm text-yellow-400">
                        请先在「服务器配置」中设置音乐文件夹路径
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 文件列表 */}
              <div className="mt-6 bg-[#1a1f2e]/50 rounded-2xl border border-white/[0.06] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">已上传文件</h4>
                  <button
                    className="text-sm text-gray-400 hover:text-white"
                    onClick={loadMusicList}
                  >
                    刷新
                  </button>
                </div>
                
                {uploadedFiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    暂无文件
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-[#0f0f1a] rounded-lg group">
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon name="music" size={16} className="text-gray-500 flex-shrink-0" />
                          <span className="text-sm text-gray-300 truncate">{file.filename}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-all"
                            onClick={() => handleDeleteMusic(file.filename)}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 歌单管理 */}
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
                  <div className="text-center py-20 bg-[#1a1f2e]/50 rounded-2xl border border-white/[0.06]">
                    <Icon name="playlist" size={64} className="mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-500 text-lg mb-2">暂无歌单</p>
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
                      className="relative group bg-[#1a1f2e]/50 hover:bg-[#1a1f2e]/70 rounded-xl border border-white/[0.06] hover:border-white/[0.1] transition-all duration-200"
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
                                className="flex-1 px-4 py-2 bg-[#0f0f1a] rounded-lg border border-white/10 focus:outline-none focus:border-blue-400 text-white text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenamePlaylist();
                                  if (e.key === 'Escape') setEditingPlaylist(null);
                                }}
                              />
                              <button className="p-2 hover:bg-green-500/20 text-green-400 rounded-lg" onClick={handleRenamePlaylist}>
                                <Icon name="check" size={16} />
                              </button>
                              <button className="p-2 hover:bg-gray-500/20 text-gray-400 rounded-lg" onClick={() => setEditingPlaylist(null)}>
                                <Icon name="x" size={16} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-base font-semibold text-white">{playlist.name}</h4>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                <span>{playlist.songCount} 首歌曲</span>
                              </div>
                            </>
                          )}
                        </div>

                        {editingPlaylist?.id !== playlist.id && (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-2.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                              onClick={() => { setEditingPlaylist(playlist); setEditName(playlist.name); }}
                            >
                              <Icon name="edit" size={16} />
                            </button>
                            <button
                              className="p-2.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400"
                              onClick={() => setDeleteConfirm(playlist.id)}
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      {deleteConfirm === playlist.id && (
                        <div className="absolute inset-0 bg-[#0f0f1a]/95 backdrop-blur-sm rounded-xl flex items-center justify-center gap-4 z-10">
                          <p className="text-gray-300">确定删除 <span className="font-semibold text-white">"{playlist.name}"</span>？</p>
                          <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm" onClick={() => handleDeletePlaylist(playlist.id)}>
                            确认删除
                          </button>
                          <button className="px-4 py-2 hover:bg-white/10 text-gray-400 rounded-lg text-sm" onClick={() => setDeleteConfirm(null)}>
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

          {/* 壁纸设置 */}
          {activeTab === 'wallpaper' && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-1">壁纸设置</h3>
                <p className="text-sm text-gray-400">自定义背景图片</p>
              </div>

              <div className="space-y-6">
                <div className="bg-[#1a1f2e]/50 rounded-2xl border border-white/[0.06] p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">上传壁纸</h4>
                  <div
                    className="border-2 border-dashed border-white/10 hover:border-blue-500/50 rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
                    onClick={() => bgInputRef.current?.click()}
                  >
                    <Icon name="image" size={48} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-400 mb-1">点击选择图片</p>
                    <p className="text-xs text-gray-600">支持 JPG, PNG, GIF, WebP</p>
                  </div>
                  <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                </div>

                <div className="bg-[#1a1f2e]/50 rounded-2xl border border-white/[0.06] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-white">当前壁纸</h4>
                    {customBg && (
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg" onClick={handleRemoveBg}>
                        <Icon name="trash" size={12} />
                        移除
                      </button>
                    )}
                  </div>
                  <div className="aspect-video rounded-xl overflow-hidden bg-[#0f0f1a] border border-white/[0.06]">
                    {customBg ? (
                      <img src={customBg} alt="壁纸" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <Icon name="image" size={48} className="text-gray-700 mb-2" />
                        <p className="text-gray-500">使用默认背景</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 服务器配置 */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-1">服务器配置</h3>
                <p className="text-sm text-gray-400">配置音乐文件夹和 Navidrome 连接</p>
              </div>

              <div className="space-y-6">
                <div className="bg-[#1a1f2e]/50 rounded-2xl border border-white/[0.06] p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">音乐文件夹</h4>
                  <input
                    type="text"
                    value={backendConfig.musicFolder}
                    onChange={(e) => setBackendConfig({ ...backendConfig, musicFolder: e.target.value })}
                    placeholder="/path/to/music"
                    className="w-full px-4 py-3 bg-[#0f0f1a] rounded-xl border border-white/10 focus:outline-none focus:border-blue-400 text-white placeholder-gray-600"
                  />
                  <p className="mt-2 text-xs text-gray-500">Navidrome 扫描的音乐文件夹路径</p>
                </div>

                <div className="bg-[#1a1f2e]/50 rounded-2xl border border-white/[0.06] p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">Navidrome 连接</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">服务器地址</label>
                      <input
                        type="text"
                        value={backendConfig.navidromeUrl}
                        onChange={(e) => setBackendConfig({ ...backendConfig, navidromeUrl: e.target.value })}
                        placeholder="http://192.168.1.100:4533"
                        className="w-full px-4 py-3 bg-[#0f0f1a] rounded-xl border border-white/10 focus:outline-none focus:border-blue-400 text-white placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">用户名</label>
                      <input
                        type="text"
                        value={backendConfig.navidromeUser}
                        onChange={(e) => setBackendConfig({ ...backendConfig, navidromeUser: e.target.value })}
                        placeholder="admin"
                        className="w-full px-4 py-3 bg-[#0f0f1a] rounded-xl border border-white/10 focus:outline-none focus:border-blue-400 text-white placeholder-gray-600"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Token</label>
                        <input
                          type="password"
                          value={backendConfig.navidromeToken}
                          onChange={(e) => setBackendConfig({ ...backendConfig, navidromeToken: e.target.value })}
                          className="w-full px-4 py-3 bg-[#0f0f1a] rounded-xl border border-white/10 focus:outline-none focus:border-blue-400 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Salt</label>
                        <input
                          type="password"
                          value={backendConfig.navidromeSalt}
                          onChange={(e) => setBackendConfig({ ...backendConfig, navidromeSalt: e.target.value })}
                          className="w-full px-4 py-3 bg-[#0f0f1a] rounded-xl border border-white/10 focus:outline-none focus:border-blue-400 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  onClick={saveBackendConfig}
                >
                  保存配置
                </button>
              </div>
            </div>
          )}

          {/* 关于 */}
          {activeTab === 'about' && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-1">关于</h3>
                <p className="text-sm text-gray-400">应用信息</p>
              </div>

              <div className="bg-[#1a1f2e]/50 rounded-2xl border border-white/[0.06] p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Icon name="music" size={32} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-white">Navidrome</h4>
                    <p className="text-gray-400">现代化的 Navidrome 音乐播放器</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0f0f1a] rounded-xl p-4">
                    <p className="text-sm text-gray-400 mb-1">版本</p>
                    <p className="text-white font-semibold">1.0.0</p>
                  </div>
                  <div className="bg-[#0f0f1a] rounded-xl p-4">
                    <p className="text-sm text-gray-400 mb-1">GitHub</p>
                    <a href="https://github.com/SnarkD2001/Navidrome" target="_blank" rel="noopener" className="text-blue-400 hover:underline">
                      SnarkD2001/Navidrome
                    </a>
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
          <div className="w-96 bg-[#1a1f2e]/95 backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl p-8">
            <h3 className="text-xl font-bold text-white mb-6">新建歌单</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="输入歌单名称"
              className="w-full px-4 py-3 bg-[#0f0f1a] rounded-xl border border-white/10 focus:outline-none focus:border-blue-400 text-white placeholder-gray-600"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreatePlaylist();
                if (e.key === 'Escape') setShowCreateDialog(false);
              }}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button className="px-5 py-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors" onClick={() => setShowCreateDialog(false)}>
                取消
              </button>
              <button className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors text-white font-medium" onClick={handleCreatePlaylist}>
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
