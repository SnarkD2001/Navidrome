import React, { useState, useEffect, useRef } from 'react';
import { SubsonicSong, ServerConfig } from '../../api/types';
import { usePlayer } from '../../hooks/usePlayer';
import { getLyrics, getCoverArtUrl } from '../../api/subsonic';
import LyricView from './LyricView';
import Icon from '../common/Icon';

interface CardExpandedPlayerProps {
  track: SubsonicSong;
  origin: { x: number; y: number; w: number; h: number };
  onClose: () => void;
}

export default function CardExpandedPlayer({ track, origin, onClose }: CardExpandedPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    mode,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    setMode,
  } = usePlayer();

  const [lyrics, setLyrics] = useState('');
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');
  const overlayRef = useRef<HTMLDivElement>(null);

  const getConfig = (): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  };

  // Fetch lyrics
  useEffect(() => {
    const config = getConfig();
    if (!config) return;
    getLyrics(config, track.artist, track.title).then(setLyrics);
  }, [track.id]);

  // Enter animation
  useEffect(() => {
    const timer = setTimeout(() => setPhase('visible'), 30);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setPhase('exiting');
    setTimeout(onClose, 400);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    seek((x / rect.width) * duration);
  };

  const modeIcons: Record<string, string> = {
    'sequential': 'repeat',
    'shuffle': 'shuffle',
    'repeat-one': 'repeat-one',
  };

  const cycleMode = () => {
    const modes: Array<'sequential' | 'shuffle' | 'repeat-one'> = ['sequential', 'shuffle', 'repeat-one'];
    setMode(modes[(modes.indexOf(mode) + 1) % modes.length]);
  };

  const getVolumeIcon = () => {
    if (volume === 0) return 'volume-mute';
    if (volume < 0.5) return 'volume-low';
    return 'volume';
  };

  const config = getConfig();
  const coverUrl = config ? getCoverArtUrl(config, track.coverArt, 600) : '';
  const bgUrl = config ? getCoverArtUrl(config, track.coverArt, 300) : '';

  // 动画样式
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 从卡片中心计算展开起点
  const originCenterX = origin.x + origin.w / 2;
  const originCenterY = origin.y + origin.h / 2;

  let animStyle: React.CSSProperties = {};
  if (phase === 'entering') {
    // 从卡片位置开始
    const scaleX = origin.w / vw;
    const scaleY = origin.h / vh;
    const tx = originCenterX - vw / 2;
    const ty = originCenterY - vh / 2;
    animStyle = {
      transform: `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`,
      opacity: 0.5,
      borderRadius: '16px',
      transition: 'none',
    };
  } else if (phase === 'visible') {
    animStyle = {
      transform: 'translate(0, 0) scale(1)',
      opacity: 1,
      borderRadius: '0px',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, border-radius 0.4s ease',
    };
  } else {
    // exiting - 缩回卡片位置
    const scaleX = origin.w / vw;
    const scaleY = origin.h / vh;
    const tx = originCenterX - vw / 2;
    const ty = originCenterY - vh / 2;
    animStyle = {
      transform: `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`,
      opacity: 0,
      borderRadius: '16px',
      transition: 'transform 0.35s cubic-bezier(0.55, 0, 1, 0.45), opacity 0.25s ease, border-radius 0.3s ease',
    };
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 overflow-hidden"
      style={animStyle}
    >
      {/* 背景模糊 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(80px) brightness(0.15)',
          transform: 'scale(1.3)',
        }}
      />
      <div className="absolute inset-0 bg-black/70" />

      {/* 关闭按钮 */}
      <button
        className="absolute top-5 right-5 z-20 text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        onClick={handleClose}
      >
        <Icon name="chevron-down" size={28} />
      </button>

      {/* 主内容：左封面 + 右歌词 */}
      <div className="relative z-10 flex items-center justify-center h-full px-16 gap-12">
        {/* 左侧：封面 + 信息 + 控制 */}
        <div className="flex flex-col items-center gap-6 flex-shrink-0" style={{ maxWidth: '40vh' }}>
          {/* 封面 */}
          <div
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{ width: 'min(360px, 38vh)', height: 'min(360px, 38vh)' }}
          >
            {coverUrl ? (
              <img src={coverUrl} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <Icon name="music" size={64} className="text-gray-600" />
              </div>
            )}
          </div>

          {/* 曲名 + 艺术家 */}
          <div className="text-center max-w-full">
            <h2 className="text-xl font-bold text-white truncate">{track.title}</h2>
            <p className="text-sm text-white/50 mt-1 truncate">{track.artist} — {track.album}</p>
          </div>

          {/* 进度条 */}
          <div className="w-full max-w-sm">
            <div
              className="h-1 bg-white/10 rounded-full cursor-pointer group"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-white rounded-full relative transition-all duration-100"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-white/40">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center gap-5">
            <button
              className={`p-1.5 rounded-full transition-colors ${
                mode !== 'sequential' ? 'text-blue-400' : 'text-white/40 hover:text-white'
              }`}
              onClick={cycleMode}
            >
              <Icon name={modeIcons[mode]} size={20} />
            </button>
            <button className="text-white/70 hover:text-white p-1.5" onClick={prev}>
              <Icon name="skip-back" size={26} />
            </button>
            <button
              className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform shadow-xl"
              onClick={togglePlay}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} size={24} className={isPlaying ? '' : 'ml-0.5'} />
            </button>
            <button className="text-white/70 hover:text-white p-1.5" onClick={next}>
              <Icon name="skip-forward" size={26} />
            </button>
            <button
              className="text-white/40 hover:text-white"
              onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
            >
              <Icon name={getVolumeIcon()} size={18} />
            </button>
          </div>
        </div>

        {/* 右侧：歌词 */}
        <div className="flex-1 max-w-lg h-[65vh] bg-white/5 rounded-2xl overflow-hidden backdrop-blur-xl border border-white/5">
          <LyricView lyrics={lyrics} currentTime={currentTime} />
        </div>
      </div>
    </div>
  );
}
