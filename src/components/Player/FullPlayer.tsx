import React, { useState, useEffect } from 'react';
import { usePlayer } from '../../hooks/usePlayer';
import { getLyrics } from '../../api/subsonic';
import { ServerConfig } from '../../api/types';
import CoverImage from '../common/CoverImage';
import LyricView from './LyricView';
import Queue from './Queue';
import Icon from '../common/Icon';

export default function FullPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    mode,
    queue,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    setMode,
    toggleFullPlayer,
  } = usePlayer();

  const [lyrics, setLyrics] = useState('');
  const [showQueue, setShowQueue] = useState(false);

  const getConfig = (): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  };

  // Fetch lyrics
  useEffect(() => {
    if (!currentTrack) return;
    const config = getConfig();
    if (!config) return;

    getLyrics(config, currentTrack.artist, currentTrack.title).then(setLyrics);
  }, [currentTrack?.id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    seek(percentage * duration);
  };

  const modeIcons = {
    'sequential': 'repeat',
    'shuffle': 'shuffle',
    'repeat-one': 'repeat-one',
  };

  const cycleMode = () => {
    const modes: Array<'sequential' | 'shuffle' | 'repeat-one'> = ['sequential', 'shuffle', 'repeat-one'];
    const currentIndex = modes.indexOf(mode);
    setMode(modes[(currentIndex + 1) % modes.length]);
  };

  const getVolumeIcon = () => {
    if (volume === 0) return 'volume-mute';
    if (volume < 0.5) return 'volume-low';
    return 'volume';
  };

  if (!currentTrack) return null;

  const config = getConfig();
  const bgUrl = config
    ? `${config.url}/rest/getCoverArt?id=${currentTrack.coverArt}&size=600&u=${config.username}&t=${config.token}&s=${config.salt}&v=1.16.1&c=navidrome-web-player`
    : '';

  return (
    <div className="full-player-overlay flex">
      {/* Background blur */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(80px) brightness(0.2)',
          transform: 'scale(1.2)',
        }}
      />
      <div className="absolute inset-0 bg-black/60" />

      {/* Close button */}
      <button
        className="absolute top-6 right-6 z-10 text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        onClick={toggleFullPlayer}
      >
        <Icon name="chevron-down" size={28} />
      </button>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 items-center justify-center gap-12 px-12">
        {/* Left: Cover & controls */}
        <div className="flex flex-col items-center gap-8 max-w-md">
          {/* Cover art */}
          <div className="w-80 h-80 rounded-3xl overflow-hidden shadow-2xl">
            <CoverImage
              coverArt={currentTrack.coverArt}
              size={600}
              alt={currentTrack.title}
              className="w-full h-full"
            />
          </div>

          {/* Track info */}
          <div className="text-center">
            <h2 className="text-2xl font-bold">{currentTrack.title}</h2>
            <p className="text-[rgb(var(--text-secondary))] mt-1">
              {currentTrack.artist} — {currentTrack.album}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full">
            <div
              className="h-1.5 bg-white/10 rounded-full cursor-pointer group"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-white rounded-full transition-all duration-100 relative"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="flex justify-between mt-2 text-sm text-[rgb(var(--text-secondary))]">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            <button
              className={`p-2 rounded-full transition-colors ${
                mode !== 'sequential' ? 'text-[rgb(var(--accent))]' : 'text-white/60 hover:text-white'
              }`}
              onClick={cycleMode}
            >
              <Icon name={modeIcons[mode]} size={22} />
            </button>
            <button className="text-white/80 hover:text-white p-2" onClick={prev}>
              <Icon name="skip-back" size={28} />
            </button>
            <button
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform shadow-2xl"
              onClick={togglePlay}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} size={28} className={isPlaying ? '' : 'ml-1'} />
            </button>
            <button className="text-white/80 hover:text-white p-2" onClick={next}>
              <Icon name="skip-forward" size={28} />
            </button>
            <button
              className="p-2 text-white/60 hover:text-white relative"
              onClick={() => setShowQueue(!showQueue)}
            >
              <Icon name="playlist" size={22} />
              {queue.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[rgb(var(--accent))] rounded-full text-[10px] flex items-center justify-center font-bold">
                  {queue.length}
                </span>
              )}
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3">
            <button
              className="text-white/60 hover:text-white"
              onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
            >
              <Icon name={getVolumeIcon()} size={20} />
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-32 accent-white"
            />
          </div>
        </div>

        {/* Right: Lyrics or Queue */}
        <div className="w-96 h-[60vh] bg-black/30 rounded-2xl overflow-hidden backdrop-blur-xl border border-white/5">
          {showQueue ? (
            <Queue onClose={() => setShowQueue(false)} />
          ) : (
            <LyricView lyrics={lyrics} currentTime={currentTime} />
          )}
        </div>
      </div>
    </div>
  );
}
