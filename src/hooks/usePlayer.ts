import { useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import { usePlayerStore } from '../store/player';
import { ServerConfig } from '../api/types';
import { getStreamUrl, scrobble } from '../api/subsonic';

export function usePlayer() {
  const soundRef = useRef<Howl | null>(null);
  const animFrameRef = useRef<number>(0);
  const isInitializedRef = useRef(false);

  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    mode,
    queue,
    queueIndex,
    play,
    togglePlay,
    next,
    prev,
    setVolume,
    setCurrentTime,
    setDuration,
    setMode,
    toggleFullPlayer,
    addToQueue,
    isFullPlayerOpen,
  } = usePlayerStore();

  const getConfig = useCallback((): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  }, []);

  // Load and play track - only when track ID changes
  useEffect(() => {
    if (!currentTrack) return;

    const config = getConfig();
    if (!config) return;

    // Stop and unload previous sound
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.unload();
      soundRef.current = null;
    }

    // Cancel any pending animation frame
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const url = getStreamUrl(config, currentTrack.id);

    const sound = new Howl({
      src: [url],
      html5: true,
      volume,
      onplay: () => {
        setDuration(sound.duration());
        updateTime();
      },
      onend: () => {
        next();
      },
      onloaderror: (_id, error) => {
        console.error('Load error:', error);
      },
    });

    soundRef.current = sound;
    isInitializedRef.current = true;

    // Play immediately
    sound.play();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [currentTrack?.id]);

  // Handle play/pause
  useEffect(() => {
    if (!soundRef.current || !isInitializedRef.current) return;

    if (isPlaying) {
      if (!soundRef.current.playing()) {
        soundRef.current.play();
      }
    } else {
      soundRef.current.pause();
    }
  }, [isPlaying]);

  // Handle volume
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.volume(volume);
    }
  }, [volume]);

  // Update time animation
  const updateTime = useCallback(() => {
    if (soundRef.current && soundRef.current.playing()) {
      setCurrentTime(soundRef.current.seek() as number);
      animFrameRef.current = requestAnimationFrame(updateTime);
    }
  }, [setCurrentTime]);

  // Seek function
  const seek = useCallback((time: number) => {
    if (soundRef.current) {
      soundRef.current.seek(time);
      setCurrentTime(time);
    }
  }, [setCurrentTime]);

  // Listen for keyboard seek events (from useKeyboardShortcuts)
  useEffect(() => {
    const handleSeekEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !soundRef.current) return;
      const current = soundRef.current.seek() as number;
      const dur = soundRef.current.duration();
      const newTime = Math.max(0, Math.min(dur, current + detail.delta));
      soundRef.current.seek(newTime);
      setCurrentTime(newTime);
    };
    window.addEventListener('nd-seek', handleSeekEvent);
    return () => window.removeEventListener('nd-seek', handleSeekEvent);
  }, [setCurrentTime]);

  // MediaSession API
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const config = getConfig();
    const coverUrl = currentTrack && config
      ? `${config.url}/rest/getCoverArt?id=${currentTrack.coverArt}&size=300&u=${config.username}&t=${config.token}&s=${config.salt}&v=1.16.1&c=navidrome-web-player`
      : '';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack?.title || '',
      artist: currentTrack?.artist || '',
      album: currentTrack?.album || '',
      artwork: currentTrack ? [{ src: coverUrl }] : [],
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
  }, [currentTrack, togglePlay, prev, next]);

  return {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    mode,
    queue,
    queueIndex,
    isFullPlayerOpen,
    play,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    setMode,
    toggleFullPlayer,
    addToQueue,
    getConfig,
  };
}
