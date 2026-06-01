import { create } from 'zustand';
import { SubsonicSong } from '../api/types';

interface WallState {
  tracks: SubsonicSong[];
  isLoading: boolean;
  source: 'playlist' | 'all' | 'recent' | 'search';
  searchQuery: string;

  // Actions
  setTracks: (tracks: SubsonicSong[]) => void;
  setIsLoading: (loading: boolean) => void;
  setSource: (source: WallState['source']) => void;
  setSearchQuery: (query: string) => void;
}

export const useWallStore = create<WallState>((set) => ({
  tracks: [],
  isLoading: false,
  source: 'all', // 默认显示全部曲目
  searchQuery: '',

  setTracks: (tracks) => set({ tracks }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSource: (source) => set({ source }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
