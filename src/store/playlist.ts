import { create } from 'zustand';
import { SubsonicPlaylist, SubsonicSong, ServerConfig } from '../api/types';
import { getPlaylists, getPlaylist, createPlaylist, updatePlaylist, deletePlaylist } from '../api/subsonic';

interface PlaylistState {
  playlists: SubsonicPlaylist[];
  activePlaylist: SubsonicPlaylist | null;
  activePlaylistTracks: SubsonicSong[];
  isLoading: boolean;
  viewMode: 'playlist' | 'all-tracks' | 'recent';

  // Actions
  setViewMode: (mode: 'playlist' | 'all-tracks' | 'recent') => void;
  fetchPlaylists: (config: ServerConfig) => Promise<void>;
  fetchPlaylistTracks: (config: ServerConfig, playlistId: string) => Promise<void>;
  createNewPlaylist: (config: ServerConfig, name: string, songIds?: string[]) => Promise<SubsonicPlaylist>;
  renamePlaylist: (config: ServerConfig, playlistId: string, name: string) => Promise<void>;
  removePlaylist: (config: ServerConfig, playlistId: string) => Promise<void>;
  addSongToPlaylist: (config: ServerConfig, playlistId: string, songId: string) => Promise<void>;
  removeSongFromPlaylist: (config: ServerConfig, playlistId: string, songId: string) => Promise<void>;
  reorderPlaylist: (config: ServerConfig, playlistId: string, songIds: string[]) => Promise<void>;
  setActivePlaylist: (playlist: SubsonicPlaylist | null) => void;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  activePlaylist: null,
  activePlaylistTracks: [],
  isLoading: false,
  viewMode: 'all-tracks', // 默认显示全部曲目

  setViewMode: (mode) => set({ viewMode: mode, activePlaylist: mode === 'playlist' ? get().activePlaylist : null }),

  fetchPlaylists: async (config) => {
    set({ isLoading: true });
    try {
      const playlists = await getPlaylists(config);
      set({ playlists, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
      set({ isLoading: false });
    }
  },

  fetchPlaylistTracks: async (config, playlistId) => {
    set({ isLoading: true });
    try {
      const playlist = await getPlaylist(config, playlistId);
      set({
        activePlaylist: playlist,
        activePlaylistTracks: playlist.entry || [],
        isLoading: false,
        viewMode: 'playlist',
      });
    } catch (error) {
      console.error('Failed to fetch playlist tracks:', error);
      set({ isLoading: false });
    }
  },

  createNewPlaylist: async (config, name, songIds = []) => {
    const playlist = await createPlaylist(config, name, songIds);
    set(state => ({ playlists: [...state.playlists, playlist] }));
    return playlist;
  },

  renamePlaylist: async (config, playlistId, name) => {
    await updatePlaylist(config, playlistId, { name });
    set(state => ({
      playlists: state.playlists.map(p => p.id === playlistId ? { ...p, name } : p),
    }));
  },

  removePlaylist: async (config, playlistId) => {
    await deletePlaylist(config, playlistId);
    set(state => ({
      playlists: state.playlists.filter(p => p.id !== playlistId),
      activePlaylist: state.activePlaylist?.id === playlistId ? null : state.activePlaylist,
    }));
  },

  addSongToPlaylist: async (config, playlistId, songId) => {
    await updatePlaylist(config, playlistId, { addSongIds: [songId] });
    // Refresh if this is the active playlist
    if (get().activePlaylist?.id === playlistId) {
      await get().fetchPlaylistTracks(config, playlistId);
    }
  },

  removeSongFromPlaylist: async (config, playlistId, songId) => {
    await updatePlaylist(config, playlistId, { removeSongIds: [songId] });
    set(state => ({
      activePlaylistTracks: state.activePlaylistTracks.filter(s => s.id !== songId),
    }));
  },

  reorderPlaylist: async (config, playlistId, songIds) => {
    await updatePlaylist(config, playlistId, { setSongIds: songIds });
    // Reorder local state
    const tracks = get().activePlaylistTracks;
    const reordered = songIds.map(id => tracks.find(s => s.id === id)).filter(Boolean) as SubsonicSong[];
    set({ activePlaylistTracks: reordered });
  },

  setActivePlaylist: (playlist) => set({ activePlaylist: playlist }),
}));
