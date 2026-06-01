import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallStore } from '../store/wall';
import { usePlaylistStore } from '../store/playlist';
import { ServerConfig } from '../api/types';
import * as api from '../api/subsonic';

export function useWall() {
  const wallStore = useWallStore();
  const playlistStore = usePlaylistStore();

  const getConfig = useCallback((): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  }, []);

  const config = getConfig();

  // Fetch all tracks (default)
  const allTracksQuery = useQuery({
    queryKey: ['allTracks'],
    queryFn: () => api.getRandomSongs(config!, 200),
    enabled: !!config,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch recent tracks
  const recentQuery = useQuery({
    queryKey: ['recentTracks'],
    queryFn: () => api.getNowPlaying(config!),
    enabled: !!config && wallStore.source === 'recent',
    staleTime: 5 * 60 * 1000,
  });

  // Search tracks
  const searchQuery = useQuery({
    queryKey: ['searchTracks', wallStore.searchQuery],
    queryFn: () => api.searchSongs(config!, wallStore.searchQuery),
    enabled: !!config && wallStore.source === 'search' && wallStore.searchQuery.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Derive wall tracks based on source
  useEffect(() => {
    let tracks: any[] = [];

    switch (wallStore.source) {
      case 'playlist':
        tracks = playlistStore.activePlaylistTracks;
        break;
      case 'all':
        tracks = allTracksQuery.data || [];
        break;
      case 'recent':
        tracks = recentQuery.data || [];
        break;
      case 'search':
        tracks = searchQuery.data || [];
        break;
    }

    wallStore.setTracks(tracks);
  }, [
    wallStore.source,
    playlistStore.activePlaylistTracks,
    allTracksQuery.data,
    recentQuery.data,
    searchQuery.data,
  ]);

  return {
    tracks: wallStore.tracks,
    isLoading: wallStore.isLoading || allTracksQuery.isLoading || recentQuery.isLoading || searchQuery.isLoading,
    source: wallStore.source,
    setSource: wallStore.setSource,
    setSearchQuery: wallStore.setSearchQuery,
  };
}
