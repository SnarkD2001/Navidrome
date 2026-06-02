import { SubsonicResponse, SubsonicSong, SubsonicPlaylist, SubsonicAlbum, ServerConfig } from './types';

const API_VERSION = '1.16.1';
const CLIENT = 'navidrome-web-player';

function buildParams(config: ServerConfig): URLSearchParams {
  return new URLSearchParams({
    u: config.username,
    t: config.token,
    s: config.salt,
    v: API_VERSION,
    c: CLIENT,
    f: 'json',
  });
}

async function apiRequest<T>(config: ServerConfig, endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const baseParams = buildParams(config);
  Object.entries(params).forEach(([key, value]) => baseParams.set(key, value));

  const url = `${config.url}/rest/${endpoint}?${baseParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data: SubsonicResponse = await response.json();
  const responseKey = data['subsonic-response'];

  if (responseKey.status !== 'ok') {
    throw new Error(responseKey.error?.message || 'Unknown API error');
  }

  return responseKey as unknown as T;
}

export function getCoverArtUrl(config: ServerConfig, coverArtId: string, size = 300): string {
  if (!coverArtId) return '';
  const params = buildParams(config);
  params.set('id', coverArtId);
  params.set('size', size.toString());
  return `${config.url}/rest/getCoverArt?${params.toString()}`;
}

export function getStreamUrl(config: ServerConfig, songId: string, options?: { format?: string; maxBitRate?: number }): string {
  const params = buildParams(config);
  params.set('id', songId);
  if (options?.format) params.set('format', options.format);
  if (options?.maxBitRate) params.set('maxBitRate', options.maxBitRate.toString());
  return `${config.url}/rest/stream?${params.toString()}`;
}

export async function ping(config: ServerConfig): Promise<boolean> {
  try {
    await apiRequest(config, 'ping');
    return true;
  } catch {
    return false;
  }
}

export async function getPlaylists(config: ServerConfig): Promise<SubsonicPlaylist[]> {
  const data = await apiRequest<{ playlists: { playlist: SubsonicPlaylist[] } }>(config, 'getPlaylists');
  return data.playlists?.playlist || [];
}

export async function getPlaylist(config: ServerConfig, playlistId: string): Promise<SubsonicPlaylist> {
  const data = await apiRequest<{ playlist: SubsonicPlaylist }>(config, 'getPlaylist', { id: playlistId });
  return data.playlist;
}

export async function createPlaylist(config: ServerConfig, name: string, songIds: string[] = []): Promise<SubsonicPlaylist> {
  const params: Record<string, string> = { name };
  if (songIds.length > 0) {
    params.songId = songIds.join(',');
  }
  const data = await apiRequest<{ playlist: SubsonicPlaylist }>(config, 'createPlaylist', params);
  return data.playlist;
}

export async function updatePlaylist(config: ServerConfig, playlistId: string, updates: {
  name?: string;
  comment?: string;
  public?: boolean;
  addSongIds?: string[];
  removeSongIds?: string[];
  setSongIds?: string[];
}): Promise<void> {
  const params: Record<string, string> = { playlistId };
  if (updates.name) params.name = updates.name;
  if (updates.comment) params.comment = updates.comment;
  if (updates.public !== undefined) params.public = updates.public.toString();
  if (updates.addSongIds?.length) params.addSongIds = updates.addSongIds.join(',');
  if (updates.removeSongIds?.length) params.removeSongIds = updates.removeSongIds.join(',');
  if (updates.setSongIds?.length) params.setSongIds = updates.setSongIds.join(',');

  await apiRequest(config, 'updatePlaylist', params);
}

export async function deletePlaylist(config: ServerConfig, playlistId: string): Promise<void> {
  await apiRequest(config, 'deletePlaylist', { id: playlistId });
}

export async function getAlbumList(config: ServerConfig, type = 'newest', size = 50, offset = 0): Promise<SubsonicAlbum[]> {
  const data = await apiRequest<{ 'album-list2': { album: SubsonicAlbum[] } }>(config, 'getAlbumList2', {
    type,
    size: size.toString(),
    offset: offset.toString(),
  });
  return data['album-list2']?.album || [];
}

export async function getAlbum(config: ServerConfig, albumId: string): Promise<SubsonicAlbum> {
  const data = await apiRequest<{ album: SubsonicAlbum }>(config, 'getAlbum', { id: albumId });
  return data.album;
}

export async function searchSongs(config: ServerConfig, query: string, count = 50): Promise<SubsonicSong[]> {
  const data = await apiRequest<{ searchResult3: { song: SubsonicSong[] } }>(config, 'search3', {
    query,
    songCount: count.toString(),
  });
  return data.searchResult3?.song || [];
}

export async function getRandomSongs(config: ServerConfig, size = 50): Promise<SubsonicSong[]> {
  const data = await apiRequest<{ randomSongs: { song: SubsonicSong[] } }>(config, 'getRandomSongs', {
    size: size.toString(),
  });
  return data.randomSongs?.song || [];
}

export async function getNowPlaying(config: ServerConfig): Promise<SubsonicSong[]> {
  const data = await apiRequest<{ nowPlaying: { entry: SubsonicSong[] } }>(config, 'getNowPlaying');
  return data.nowPlaying?.entry || [];
}

export async function scrobble(config: ServerConfig, songId: string, submission = true): Promise<void> {
  await apiRequest(config, 'scrobble', {
    id: songId,
    submission: submission.toString(),
  });
}

export async function star(config: ServerConfig, songId: string): Promise<void> {
  await apiRequest(config, 'star', { id: songId });
}

export async function unstar(config: ServerConfig, songId: string): Promise<void> {
  await apiRequest(config, 'unstar', { id: songId });
}

export async function getLyrics(config: ServerConfig, artist: string, title: string): Promise<string> {
  try {
    const data = await apiRequest<{ lyrics: { value: string } }>(config, 'getLyrics', { artist, title });
    return data.lyrics?.value || '';
  } catch {
    return '';
  }
}
