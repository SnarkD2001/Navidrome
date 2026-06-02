import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServerConfig } from '../api/types';
import Login from './Login';
import AdminPage from './AdminPage';
import BackgroundWall from '../components/Wall/BackgroundWall';
import MiniPlayer from '../components/Player/MiniPlayer';
import FullPlayer from '../components/Player/FullPlayer';
import { usePlayerStore } from '../store/player';
import { usePlaylistStore } from '../store/playlist';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

type AppView = 'main' | 'admin';

function AppContent() {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('main');
  const { isFullPlayerOpen } = usePlayerStore();
  const { fetchPlaylists } = usePlaylistStore();
  useKeyboardShortcuts();

  useEffect(() => {
    // 检查 URL 路径
    const path = window.location.pathname;
    if (path === '/admin' || path === '/settings') {
      setCurrentView('admin');
    }

    // 加载保存的配置
    const savedConfig = localStorage.getItem('navidrome-server');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
      } catch (e) {
        console.error('Failed to parse saved config:', e);
        localStorage.removeItem('navidrome-server');
      }
    }

    // 加载主题
    const savedTheme = localStorage.getItem('navidrome-theme');
    if (savedTheme) {
      document.documentElement.className = savedTheme;
    } else {
      document.documentElement.className = 'dark';
    }

    // 加载音量
    const savedVolume = localStorage.getItem('navidrome-volume');
    if (savedVolume) {
      usePlayerStore.getState().setVolume(parseFloat(savedVolume));
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (config) {
      fetchPlaylists(config);
    }
  }, [config]);

  const handleLogin = (newConfig: ServerConfig) => {
    setConfig(newConfig);
  };

  const handleLogout = () => {
    localStorage.removeItem('navidrome-server');
    setConfig(null);
    setCurrentView('main');
    window.history.pushState({}, '', '/');
  };

  const navigateTo = (view: AppView) => {
    setCurrentView(view);
    if (view === 'admin') {
      window.history.pushState({}, '', '/admin');
    } else {
      window.history.pushState({}, '', '/');
    }
  };

  // 监听浏览器前进后退
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/admin' || path === '/settings') {
        setCurrentView('admin');
      } else {
        setCurrentView('main');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!config) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentView === 'admin') {
    return (
      <AdminPage
        onBack={() => navigateTo('main')}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <>
      <BackgroundWall onLogout={handleLogout} />
      <MiniPlayer />
      {isFullPlayerOpen && <FullPlayer />}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
