import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  const getConfig = (): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  };

  useEffect(() => {
    const config = getConfig();
    if (!config) return;
    getLyrics(config, track.artist, track.title).then(setLyrics);
  }, [track.id]);

  useEffect(() => {
    const timer = setTimeout(() => setPhase('visible'), 30);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleClose = () => {
    setPhase('exiting');
    setTimeout(onClose, 350);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * duration);
  };

  const modeIcons: Record<string, string> = { sequential: 'repeat', shuffle: 'shuffle', 'repeat-one': 'repeat-one' };
  const cycleMode = () => {
    const modes: Array<'sequential' | 'shuffle' | 'repeat-one'> = ['sequential', 'shuffle', 'repeat-one'];
    setMode(modes[(modes.indexOf(mode) + 1) % modes.length]);
  };

  const config = getConfig();
  const coverUrl = config ? getCoverArtUrl(config, track.coverArt, 600) : '';

  const cardW = Math.min(1100, window.innerWidth * 0.82);
  const cardH = Math.min(680, window.innerHeight * 0.75);
  const cardX = (window.innerWidth - cardW) / 2;
  const cardY = (window.innerHeight - cardH) / 2;

  let cardStyle: React.CSSProperties;
  if (phase === 'entering') {
    cardStyle = {
      left: origin.x,
      top: origin.y,
      width: origin.w,
      height: origin.h,
      opacity: 0.7,
      borderRadius: '16px',
      transition: 'none',
    };
  } else if (phase === 'visible') {
    cardStyle = {
      left: cardX,
      top: cardY,
      width: cardW,
      height: cardH,
      opacity: 1,
      borderRadius: '24px',
      transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
    };
  } else {
    cardStyle = {
      left: origin.x,
      top: origin.y,
      width: origin.w,
      height: origin.h,
      opacity: 0,
      borderRadius: '16px',
      transition: 'all 0.3s cubic-bezier(0.55, 0, 1, 0.45)',
    };
  }

  return createPortal(
    <>
      {/* 透明点击遮罩：覆盖全屏但完全透明，只拦截点击 */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'transparent' }}
        onClick={handleClose}
      />

      {/* 展开的卡片 — 毛玻璃 */}
      <div
        style={{
          position: 'fixed',
          zIndex: 51,
          overflow: 'hidden',
          backdropFilter: 'blur(40px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
          background: 'rgba(255, 255, 255, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          ...cardStyle,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          className="absolute top-4 right-4 z-20 text-white/50 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
          onClick={handleClose}
        >
          <Icon name="close" size={22} />
        </button>

        {/* 内容 */}
        <div className="relative z-10 flex items-stretch h-full p-8 gap-8">
          {/* 左侧 */}
          <div className="flex flex-col items-center justify-center gap-5 flex-shrink-0" style={{ width: '38%' }}>
            <div className="w-full aspect-square max-w-[320px] rounded-2xl overflow-hidden shadow-xl">
              {coverUrl ? (
                <img src={coverUrl} alt={track.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center rounded-2xl">
                  <Icon name="music" size={48} className="text-white/20" />
                </div>
              )}
            </div>

            <div className="text-center max-w-full">
              <h2 className="text-lg font-bold text-white truncate">{track.title}</h2>
              <p className="text-xs text-white/40 mt-0.5 truncate">{track.artist} — {track.album}</p>
            </div>

            <div className="w-full max-w-[280px]">
              <div className="h-1 bg-white/10 rounded-full cursor-pointer group" onClick={handleProgressClick}>
                <div
                  className="h-full bg-white/80 rounded-full relative transition-all duration-100"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-white/30">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                className={`p-1 rounded-full transition-colors ${mode !== 'sequential' ? 'text-blue-300' : 'text-white/30 hover:text-white'}`}
                onClick={cycleMode}
              >
                <Icon name={modeIcons[mode]} size={18} />
              </button>
              <button className="text-white/60 hover:text-white p-1" onClick={prev}>
                <Icon name="skip-back" size={22} />
              </button>
              <button
                className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-black hover:bg-white hover:scale-105 transition-all shadow-lg"
                onClick={togglePlay}
              >
                <Icon name={isPlaying ? 'pause' : 'play'} size={22} className={isPlaying ? '' : 'ml-0.5'} />
              </button>
              <button className="text-white/60 hover:text-white p-1" onClick={next}>
                <Icon name="skip-forward" size={22} />
              </button>
              <button
                className="text-white/30 hover:text-white"
                onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
              >
                <Icon name={volume === 0 ? 'volume-mute' : volume < 0.5 ? 'volume-low' : 'volume'} size={16} />
              </button>
            </div>
          </div>

          {/* 右侧：歌词 */}
          <div className="flex-1 min-w-0 bg-white/5 rounded-xl overflow-hidden border border-white/5">
            <LyricView lyrics={lyrics} currentTime={currentTime} />
          </div>
        </div>
      </div>
    </>
  , document.body);
}
