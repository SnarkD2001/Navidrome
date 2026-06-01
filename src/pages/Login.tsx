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

      const params = new URLSearchParams({
        u: config.username,
        t: config.token,
        s: config.salt,
        v: '1.16.1',
        c: 'navidrome-web-player',
        f: 'json',
      });

      const pingUrl = `${config.url}/rest/ping?${params.toString()}`;
      const response = await fetch(pingUrl);
      
      if (!response.ok) {
        throw new Error(`服务器返回错误: ${response.status}`);
      }

      const data = await response.json();

      if (data['subsonic-response']?.status !== 'ok') {
        throw new Error(data['subsonic-response']?.error?.message || '认证失败');
      }

      localStorage.setItem('navidrome-server', JSON.stringify(config));
      onLogin(config);
    } catch (err: any) {
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
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Icon name="music" size={24} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">Navidrome</h1>
          </div>
          <p className="text-gray-500">连接你的私人音乐库</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">服务器地址</label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.100:4533"
              className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              示例: http://192.168.1.100:4533 或 https://music.example.com
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400"
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center py-3 bg-red-50 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all duration-200 text-white hover:scale-[1.02] active:scale-[0.98]"
          >
            {isLoading ? '连接中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-400">
          支持 Subsonic API 1.16.1+
        </div>
      </div>
    </div>
  );
}
