import { create } from 'zustand';
import { SubsonicSong, PlaybackMode, ServerConfig } from '../api/types';
import { getStreamUrl, scrobble } from '../api/subsonic';

interface PlayHistoryItem {
  song: SubsonicSong;
  playedAt: number;
}

interface PlayerState {
  // Current state
  currentTrack: SubsonicSong | null;
  queue: SubsonicSong[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  mode: PlaybackMode['type'];
  isFullPlayerOpen: boolean;

  // History
  history: PlayHistoryItem[];

  // Actions
  play: (song: SubsonicSong, queue?: SubsonicSong[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setMode: (mode: PlaybackMode['type']) => void;
  toggleFullPlayer: () => void;
  addToQueue: (song: SubsonicSong) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

const HISTORY_KEY = 'navidrome-play-history';
const MAX_HISTORY = 200;

function loadHistory(): PlayHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(history: PlayHistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: 0.7,
  currentTime: 0,
  duration: 0,
  mode: 'sequential',
  isFullPlayerOpen: false,
  history: loadHistory(),

  play: (song, queue) => {
    const newQueue = queue || get().queue;
    const index = newQueue.findIndex(s => s.id === song.id);

    // Scrobble
    const configStr = localStorage.getItem('navidrome-server');
    if (configStr) {
      const config: ServerConfig = JSON.parse(configStr);
      scrobble(config, song.id).catch(() => {});
    }

    // Save to history
    const historyItem: PlayHistoryItem = { song, playedAt: Date.now() };
    const newHistory = [historyItem, ...get().history].slice(0, MAX_HISTORY);
    saveHistory(newHistory);

    set({
      currentTrack: song,
      queue: newQueue,
      queueIndex: index >= 0 ? index : 0,
      isPlaying: true,
      currentTime: 0,
      duration: song.duration || 0,
      history: newHistory,
    });
  },

  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),

  next: () => {
    const { queue, queueIndex, mode } = get();
    if (queue.length === 0) return;

    let nextIndex: number;
    if (mode === 'repeat-one') {
      nextIndex = queueIndex;
    } else if (mode === 'shuffle') {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = (queueIndex + 1) % queue.length;
    }

    const nextSong = queue[nextIndex];
    if (nextSong) {
      get().play(nextSong);
    }
  },

  prev: () => {
    const { queue, queueIndex, currentTime } = get();
    if (queue.length === 0) return;

    // If more than 3 seconds in, restart current song
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }

    const prevIndex = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1;
    const prevSong = queue[prevIndex];
    if (prevSong) {
      get().play(prevSong);
    }
  },

  setVolume: (volume) => {
    localStorage.setItem('navidrome-volume', volume.toString());
    set({ volume });
  },

  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setMode: (mode) => set({ mode }),
  toggleFullPlayer: () => set(state => ({ isFullPlayerOpen: !state.isFullPlayerOpen })),

  addToQueue: (song) => set(state => ({
    queue: [...state.queue, song],
  })),

  removeFromQueue: (index) => set(state => ({
    queue: state.queue.filter((_, i) => i !== index),
  })),

  clearQueue: () => set({ queue: [], queueIndex: -1 }),
}));
