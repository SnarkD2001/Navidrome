export interface SubsonicResponse {
  'subsonic-response': {
    status: string;
    version: string;
    [key: string]: any;
  };
}

export interface SubsonicSong {
  id: string;
  parent: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  track: number;
  year: number;
  genre: string;
  coverArt: string;
  size: number;
  contentType: string;
  suffix: string;
  duration: number;
  bitRate: number;
  path: string;
  playCount: number;
  starred?: string;
  created: string;
}

export interface SubsonicPlaylist {
  id: string;
  name: string;
  comment?: string;
  owner: string;
  public: boolean;
  songCount: number;
  duration: number;
  created: string;
  changed: string;
  coverArt?: string;
  entry?: SubsonicSong[];
}

export interface SubsonicArtist {
  id: string;
  name: string;
  coverArt?: string;
  albumCount: number;
}

export interface SubsonicAlbum {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  coverArt?: string;
  songCount: number;
  duration: number;
  created: string;
  year?: number;
  genre?: string;
  song?: SubsonicSong[];
}

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  username: string;
  token: string;
  salt: string;
}

export interface PlaybackMode {
  type: 'sequential' | 'shuffle' | 'repeat-one';
}

export interface LyricLine {
  time: number;
  text: string;
}
