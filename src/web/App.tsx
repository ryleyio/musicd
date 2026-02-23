import React, { useState, useEffect } from 'react';
import { usePlayer, type Track } from './hooks/usePlayer';
import Player from './components/Player';
import TrackList from './components/TrackList';
import AlbumList from './components/AlbumList';
import ArtistList from './components/ArtistList';
import Search from './components/Search';
import Queue from './components/Queue';
import NowPlaying from './components/NowPlaying';

type View = 'tracks' | 'albums' | 'artists' | 'queue';

interface Album {
  album: string;
  artist: string;
  coverId: number | null;
  trackCount: number;
  year: number | null;
}

interface Artist {
  name: string;
  trackCount: number;
}

interface Stats {
  trackCount: number;
  artistCount: number;
  albumCount: number;
}

export default function App() {
  const [view, setView] = useState<View>('albums');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<{ album: string; artist: string } | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<{ tracks: Track[]; albums: Album[]; artists: string[] } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);

  const player = usePlayer();

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats);
    fetch('/api/albums').then(r => r.json()).then(setAlbums);
    fetch('/api/artists').then(r => r.json()).then(setArtists);
  }, []);

  useEffect(() => {
    if (view === 'tracks' && tracks.length === 0) {
      fetch('/api/tracks').then(r => r.json()).then(setTracks);
    }
  }, [view, tracks.length]);

  const loadAlbumTracks = async (album: string, artist: string) => {
    const res = await fetch(`/api/albums/tracks?album=${encodeURIComponent(album)}&artist=${encodeURIComponent(artist)}`);
    const data = await res.json();
    setTracks(data);
    setSelectedAlbum({ album, artist });
    setSelectedArtist(null);
    setSearchResults(null);
  };

  const loadArtistAlbums = async (artist: string) => {
    const res = await fetch(`/api/artists/${encodeURIComponent(artist)}/albums`);
    const data = await res.json();
    setAlbums(data);
    setSelectedArtist(artist);
    setSelectedAlbum(null);
    setSearchResults(null);
    setView('albums');
  };

  const handleSearch = async (query: string) => {
    if (!query) {
      setSearchResults(null);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setSearchResults(data);
  };

  const clearSelection = () => {
    setSelectedAlbum(null);
    setSelectedArtist(null);
    setSearchResults(null);
    setShowSearch(false);
    fetch('/api/albums').then(r => r.json()).then(setAlbums);
  };

  const navItems: { view: View; icon: string; label: string }[] = [
    { view: 'albums', icon: '💿', label: 'Albums' },
    { view: 'artists', icon: '🎤', label: 'Artists' },
    { view: 'tracks', icon: '🎵', label: 'Tracks' },
    { view: 'queue', icon: '📋', label: 'Queue' },
  ];

  return (
    <>
      <style>{`
        .app-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
        }

        /* Header */
        .app-header {
          padding: 12px 20px;
          background: #111;
          border-bottom: 1px solid #222;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          flex-shrink: 0;
        }
        .app-title {
          font-size: 20px;
          font-weight: bold;
          color: #1db954;
        }
        .app-stats {
          color: #666;
          font-size: 14px;
        }
        .search-toggle {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
          display: none;
        }
        .search-wrapper {
          flex: 1;
          max-width: 400px;
        }
        .search-overlay {
          display: none;
        }

        /* Main layout */
        .app-main {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        /* Desktop sidebar */
        .app-sidebar {
          width: 200px;
          background: #111;
          padding: 20px;
          border-right: 1px solid #222;
          flex-shrink: 0;
        }
        .nav-list {
          list-style: none;
        }
        .nav-item {
          padding: 12px 15px;
          margin-bottom: 5px;
          border-radius: 5px;
          cursor: pointer;
          color: #999;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.2s;
        }
        .nav-item:hover {
          color: #fff;
          background: #222;
        }
        .nav-item.active {
          background: #333;
          color: #fff;
        }
        .nav-icon {
          font-size: 18px;
        }

        /* Content area */
        .app-content {
          flex: 1;
          overflow: auto;
          padding: 20px;
          padding-bottom: 100px;
        }

        /* Bottom navigation (hidden on desktop) */
        .bottom-nav {
          display: none;
        }

        /* Back button */
        .back-btn {
          background: none;
          border: 1px solid #333;
          color: #999;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          margin-bottom: 15px;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .back-btn:hover {
          color: #fff;
          border-color: #666;
        }

        /* Play album button */
        .play-album-btn {
          background: #1db954;
          border: none;
          padding: 12px 24px;
          border-radius: 24px;
          color: #000;
          font-weight: bold;
          cursor: pointer;
          margin-bottom: 20px;
          font-size: 14px;
          transition: all 0.2s;
        }
        .play-album-btn:hover {
          background: #1ed760;
          transform: scale(1.02);
        }

        /* Section headers */
        .section-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .section-subtitle {
          color: #999;
          margin-bottom: 20px;
        }
        .search-header {
          margin-bottom: 20px;
          cursor: pointer;
        }
        .search-section-title {
          color: #999;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 0 10px;
        }
        .artist-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
        }
        .artist-chip {
          background: #282828;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          color: #1db954;
          transition: all 0.2s;
        }
        .artist-chip:hover {
          background: #333;
        }

        /* ===== MOBILE STYLES ===== */
        @media (max-width: 768px) {
          .app-header {
            padding: 10px 15px;
          }
          .app-stats {
            display: none;
          }
          .search-toggle {
            display: block;
          }
          .search-wrapper {
            display: none;
          }
          .search-overlay {
            display: ${showSearch ? 'block' : 'none'};
            position: fixed;
            inset: 0;
            background: #0a0a0a;
            z-index: 100;
            padding: 15px;
          }
          .search-overlay-header {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
          }
          .search-overlay-close {
            background: none;
            border: none;
            color: #999;
            font-size: 24px;
            cursor: pointer;
            padding: 5px;
          }
          .search-overlay .search-input-wrapper {
            flex: 1;
          }

          /* Hide desktop sidebar */
          .app-sidebar {
            display: none;
          }

          /* Full width content */
          .app-content {
            padding: 15px;
            padding-bottom: 160px;
          }

          /* Show bottom navigation */
          .bottom-nav {
            display: flex;
            position: fixed;
            bottom: 80px;
            left: 0;
            right: 0;
            background: #111;
            border-top: 1px solid #222;
            justify-content: space-around;
            padding: 8px 0;
            z-index: 50;
          }
          .bottom-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 8px 16px;
            color: #666;
            cursor: pointer;
            border-radius: 8px;
            transition: all 0.2s;
            background: none;
            border: none;
            font-size: 10px;
          }
          .bottom-nav-item.active {
            color: #1db954;
          }
          .bottom-nav-icon {
            font-size: 22px;
          }

          .section-title {
            font-size: 20px;
          }
        }

        /* Small mobile */
        @media (max-width: 480px) {
          .app-header {
            padding: 8px 12px;
          }
          .app-title {
            font-size: 18px;
          }
          .app-content {
            padding: 12px;
            padding-bottom: 170px;
          }
        }
      `}</style>

      <div className="app-container">
        <header className="app-header">
          <span className="app-title">musicd</span>
          <div className="search-wrapper">
            <Search onSearch={handleSearch} />
          </div>
          <button className="search-toggle" onClick={() => setShowSearch(true)}>
            🔍
          </button>
          {stats && (
            <span className="app-stats">
              {stats.trackCount} tracks
            </span>
          )}
        </header>

        {/* Mobile search overlay */}
        <div className="search-overlay">
          <div className="search-overlay-header">
            <button className="search-overlay-close" onClick={() => { setShowSearch(false); setSearchResults(null); }}>
              ←
            </button>
            <div className="search-input-wrapper">
              <Search onSearch={handleSearch} autoFocus />
            </div>
          </div>
          {searchResults && (
            <div className="app-content" style={{ padding: 0, paddingBottom: 0 }}>
              {searchResults.artists.length > 0 && (
                <>
                  <div className="search-section-title">Artists</div>
                  <div className="artist-chips">
                    {searchResults.artists.map(a => (
                      <span key={a} className="artist-chip" onClick={() => { loadArtistAlbums(a); setShowSearch(false); }}>
                        {a}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {searchResults.albums.length > 0 && (
                <>
                  <div className="search-section-title">Albums</div>
                  <AlbumList
                    albums={searchResults.albums as Album[]}
                    onSelect={(a) => { loadAlbumTracks(a.album, a.artist); setShowSearch(false); }}
                  />
                </>
              )}
              {searchResults.tracks.length > 0 && (
                <>
                  <div className="search-section-title">Tracks</div>
                  <TrackList
                    tracks={searchResults.tracks}
                    onPlay={(t) => { player.play(t); setShowSearch(false); }}
                    onAddToQueue={player.addToQueue}
                    currentTrack={player.currentTrack}
                    isPlaying={player.isPlaying}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div className="app-main">
          {/* Desktop sidebar */}
          <nav className="app-sidebar">
            <ul className="nav-list">
              {navItems.map(item => (
                <li
                  key={item.view}
                  className={`nav-item ${view === item.view ? 'active' : ''}`}
                  onClick={() => { setView(item.view); if (item.view !== 'queue') clearSelection(); }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </nav>

          <main className="app-content">
            {searchResults && !showSearch ? (
              <div>
                <h2 className="search-header" onClick={clearSelection}>
                  Search Results <span style={{ fontSize: '14px', color: '#666' }}>(tap to clear)</span>
                </h2>
                {searchResults.artists.length > 0 && (
                  <>
                    <div className="search-section-title">Artists</div>
                    <div className="artist-chips">
                      {searchResults.artists.map(a => (
                        <span key={a} className="artist-chip" onClick={() => loadArtistAlbums(a)}>
                          {a}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {searchResults.albums.length > 0 && (
                  <>
                    <div className="search-section-title">Albums</div>
                    <AlbumList
                      albums={searchResults.albums as Album[]}
                      onSelect={(a) => loadAlbumTracks(a.album, a.artist)}
                    />
                  </>
                )}
                {searchResults.tracks.length > 0 && (
                  <>
                    <div className="search-section-title">Tracks</div>
                    <TrackList
                      tracks={searchResults.tracks}
                      onPlay={player.play}
                      onAddToQueue={player.addToQueue}
                      currentTrack={player.currentTrack}
                      isPlaying={player.isPlaying}
                    />
                  </>
                )}
              </div>
            ) : view === 'queue' ? (
              <Queue
                currentTrack={player.currentTrack}
                queue={player.queue}
                onClear={player.clearQueue}
              />
            ) : view === 'artists' ? (
              <ArtistList artists={artists} onSelect={loadArtistAlbums} />
            ) : selectedAlbum ? (
              <div>
                <button className="back-btn" onClick={clearSelection}>
                  ← Back
                </button>
                <h2 className="section-title">{selectedAlbum.album}</h2>
                <p className="section-subtitle">{selectedAlbum.artist}</p>
                <button className="play-album-btn" onClick={() => player.playAlbum(tracks)}>
                  ▶ Play Album
                </button>
                <TrackList
                  tracks={tracks}
                  onPlay={player.play}
                  onAddToQueue={player.addToQueue}
                  currentTrack={player.currentTrack}
                  isPlaying={player.isPlaying}
                />
              </div>
            ) : view === 'albums' ? (
              <div>
                {selectedArtist && (
                  <button className="back-btn" onClick={clearSelection}>
                    ← All Albums
                  </button>
                )}
                <AlbumList albums={albums} onSelect={(a) => loadAlbumTracks(a.album, a.artist)} />
              </div>
            ) : (
              <TrackList
                tracks={tracks}
                onPlay={player.play}
                onAddToQueue={player.addToQueue}
                currentTrack={player.currentTrack}
                isPlaying={player.isPlaying}
              />
            )}
          </main>
        </div>

        {/* Bottom navigation (mobile only) */}
        <nav className="bottom-nav">
          {navItems.map(item => (
            <button
              key={item.view}
              className={`bottom-nav-item ${view === item.view ? 'active' : ''}`}
              onClick={() => { setView(item.view); if (item.view !== 'queue') clearSelection(); }}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <Player
          track={player.currentTrack}
          isPlaying={player.isPlaying}
          currentTime={player.currentTime}
          duration={player.duration}
          volume={player.volume}
          onTogglePlay={player.togglePlay}
          onSeek={player.seek}
          onVolumeChange={player.setVolume}
          onNext={player.playNext}
          queueLength={player.queue.length}
          onExpand={() => setShowNowPlaying(true)}
        />

        {showNowPlaying && (
          <NowPlaying
            track={player.currentTrack}
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            onTogglePlay={player.togglePlay}
            onSeek={player.seek}
            onNext={player.playNext}
            onPrev={player.playPrev}
            onClose={() => setShowNowPlaying(false)}
            queue={player.queue}
            queueIndex={player.history.length}
          />
        )}
      </div>
    </>
  );
}
