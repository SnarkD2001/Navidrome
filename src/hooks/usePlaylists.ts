import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlaylistStore } from '../store/playlist';
import { ServerConfig } from '../api/types';
import * as api from '../api/subsonic';

export function usePlaylists() {
  const queryClient = useQueryClient();

  const getConfig = useCallback((): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  }, []);

  const config = getConfig();

  // Fetch playlists
  const playlistsQuery = useQuery({
    queryKey: ['playlists'],
    queryFn: () => api.getPlaylists(config!),
    enabled: !!config,
    staleTime: 5 * 60 * 1000,
  });

  // Sync with store
  useEffect(() => {
    if (playlistsQuery.data) {
      usePlaylistStore.setState({ playlists: playlistsQuery.data });
    }
  }, [playlistsQuery.data]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: ({ name, songIds }: { name: string; songIds?: string[] }) =>
      api.createPlaylist(config!, name, songIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playlists'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ playlistId, updates }: { playlistId: string; updates: Parameters<typeof api.updatePlaylist>[2] }) =>
      api.updatePlaylist(config!, playlistId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['playlistTracks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (playlistId: string) => api.deletePlaylist(config!, playlistId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playlists'] }),
  });

  // Fetch playlist tracks
  const fetchPlaylistTracks = useCallback(async (config: ServerConfig, playlistId: string) => {
    const playlist = await api.getPlaylist(config, playlistId);
    usePlaylistStore.setState({
      activePlaylist: playlist,
      activePlaylistTracks: playlist.entry || [],
      isLoading: false,
      viewMode: 'playlist',
    });
  }, []);

  return {
    playlists: playlistsQuery.data || [],
    isLoading: playlistsQuery.isLoading,
    activePlaylistTracks: usePlaylistStore.getState().activePlaylistTracks,
    fetchPlaylistTracks,
    createNewPlaylist: createMutation.mutateAsync,
    renamePlaylist: ({ playlistId, name }: { playlistId: string; name: string }) =>
      updateMutation.mutateAsync({ playlistId, updates: { name } }),
    removePlaylist: deleteMutation.mutateAsync,
    addSongToPlaylist: ({ playlistId, songId }: { playlistId: string; songId: string }) =>
      updateMutation.mutateAsync({ playlistId, updates: { addSongIds: [songId] } }),
    updatePlaylist: updateMutation.mutateAsync,
    deletePlaylist: deleteMutation.mutateAsync,
    refetch: playlistsQuery.refetch,
  };
}
