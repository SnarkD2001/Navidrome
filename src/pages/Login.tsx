import React, { useState } from 'react';
import md5 from 'md5';
import { ServerConfig } from '../api/types';
import Icon from '../components/common/Icon';

interface LoginProps {
  onLogin: (config: ServerConfig) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [serverUrl, setServerUrl] = useState('http://');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const salt = Math.random().toString(36).substring(2, 15);
      const token = md5(password + salt);

      const config: ServerConfig = {
        id: Date.now().toString(),
        name: new URL(serverUrl).hostname,
        url: serverUrl.replace(/\/$/, ''),
        username,
        token,
        salt,
      };

      // Test connection with fetch directly
      const params = new URLSearchParams({
        u: config.username,
        t: config.token,
        s: config.salt,
        v: '1.16.1',
        c: 'navidrome-web-player',
        f: 'json',
      });

      const pingUrl = `${config.url}/rest/ping?${params.toString()}`;
      console.log('Testing connection to:', pingUrl);

      const response = await fetch(pingUrl);
      if (!response.ok) {
        throw new Error(`服务器返回错误: ${response.status}`);
      }

      const data = await response.json();
      console.log('Ping response:', data);

      if (data['subsonic-response']?.status !== 'ok') {
        throw new Error(data['subsonic-response']?.error?.message || '认证失败');
      }

      // Save config
      localStorage.setItem('navidrome-server', JSON.stringify(config));
      console.log('Config saved, calling onLogin');
      onLogin(config);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError('无法连接到服务器，请检查地址是否正确');
      } else {
        setError(err.message || '登录失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg-primary))]">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Icon name="music" size={40} className="text-[rgb(var(--accent))]" />
            <h1 className="text-4xl font-bold">Navidrome</h1>
          </div>
          <p className="text-[rgb(var(--text-secondary))]">连接你的私人音乐库</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">服务器地址</label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.100:4533"
              className="w-full px-4 py-3 bg-[rgb(var(--bg-card))] rounded-xl border border-white/10 focus:outline-none focus:border-[rgb(var(--accent))] transition-colors"
              required
            />
            <p className="text-xs text-[rgb(var(--text-secondary))] mt-1">
              示例: http://192.168.1.100:4533 或 https://music.example.com
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-4 py-3 bg-[rgb(var(--bg-card))] rounded-xl border border-white/10 focus:outline-none focus:border-[rgb(var(--accent))] transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-[rgb(var(--bg-card))] rounded-xl border border-white/10 focus:outline-none focus:border-[rgb(var(--accent))] transition-colors"
              required
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center py-2 bg-red-400/10 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accent-hover))] disabled:opacity-50 rounded-xl font-medium transition-colors"
          >
            {isLoading ? '连接中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-[rgb(var(--text-secondary))]">
          支持 Subsonic API 1.16.1+
        </div>
      </div>
    </div>
  );
}
