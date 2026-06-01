import React from 'react';
import { usePlayer } from '../../hooks/usePlayer';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';

export default function MiniPlayer() {
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
    toggleFullPlayer,
    getConfig,
  } = usePlayer();

  if (!currentTrack) return null;

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

  const config = getConfig();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/80 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
        {/* 封面 */}
        <div
          className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer hover:scale-105 transition-transform duration-200"
          onClick={toggleFullPlayer}
        >
          <CoverImage 
            coverArt={currentTrack.coverArt} 
            size={60} 
            alt={currentTrack.title} 
            className="w-full h-full" 
          />
        </div>

        {/* 曲名和艺术家 */}
        <div className="w-32 min-w-0 hidden sm:block">
          <div className="text-sm font-medium text-white truncate">{currentTrack.title}</div>
          <div className="text-xs text-gray-400 truncate">{currentTrack.artist}</div>
        </div>

        {/* 分隔线 */}
        <div className="w-px h-8 bg-white/10 hidden sm:block" />

        {/* 播放控制 */}
        <div className="flex items-center gap-1">
          <button
            className={`p-2 rounded-full transition-all duration-200 ${
              mode !== 'sequential' 
                ? 'text-blue-400 hover:bg-white/10' 
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            onClick={cycleMode}
            title={mode === 'sequential' ? '顺序播放' : mode === 'shuffle' ? '随机播放' : '单曲循环'}
          >
            <Icon name={modeIcons[mode]} size={16} />
          </button>
          
          <button 
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200" 
            onClick={prev}
          >
            <Icon name="skip-back" size={18} />
          </button>
          
          <button
            className="w-10 h-10 rounded-full bg-white hover:bg-gray-200 flex items-center justify-center text-black transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={togglePlay}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={18} className={isPlaying ? '' : 'ml-0.5'} />
          </button>
          
          <button 
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200" 
            onClick={next}
          >
            <Icon name="skip-forward" size={18} />
          </button>
        </div>

        {/* 分隔线 */}
        <div className="w-px h-8 bg-white/10 hidden md:block" />

        {/* 进度条 */}
        <div className="hidden md:flex items-center gap-2 w-48">
          <span className="text-xs text-gray-400 tabular-nums w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <div
            className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group relative"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-white rounded-full transition-all duration-100 relative"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>
          <span className="text-xs text-gray-400 tabular-nums w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* 分隔线 */}
        <div className="w-px h-8 bg-white/10 hidden lg:block" />

        {/* 音量 */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
          >
            <Icon name={getVolumeIcon()} size={16} />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
          />
        </div>
      </div>
    </div>
  );
}
