import React from 'react';

interface Album {
  album: string;
  artist: string;
  coverId: number | null;
  trackCount?: number;
  year?: number | null;
}

interface AlbumListProps {
  albums: Album[];
  onSelect: (album: Album) => void;
}

export default function AlbumList({ albums, onSelect }: AlbumListProps) {
  return (
    <>
      <style>{`
        .album-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 20px;
        }
        .album-card {
          background: #181818;
          border-radius: 8px;
          padding: 15px;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .album-card:hover {
          background: #282828;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .album-cover-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          margin-bottom: 12px;
          border-radius: 4px;
          overflow: hidden;
          background: #333;
        }
        .album-cover {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          color: #666;
        }
        .album-cover-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s;
        }
        .album-card:hover .album-cover-img {
          transform: scale(1.05);
        }
        .album-play-overlay {
          position: absolute;
          bottom: 8px;
          right: 8px;
          width: 48px;
          height: 48px;
          background: #1db954;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #000;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .album-card:hover .album-play-overlay {
          opacity: 1;
          transform: translateY(0);
        }
        .album-play-overlay:hover {
          transform: scale(1.06);
          background: #1ed760;
        }
        .album-title {
          font-weight: bold;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .album-artist {
          color: #999;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.2s;
        }
        .album-card:hover .album-artist {
          color: #b3b3b3;
        }
        .album-meta {
          color: #666;
          font-size: 12px;
          margin-top: 4px;
        }

        /* ===== MOBILE STYLES ===== */
        @media (max-width: 768px) {
          .album-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 12px;
          }
          .album-card {
            padding: 12px;
          }
          .album-card:hover {
            transform: none;
            box-shadow: none;
          }
          .album-card:active {
            background: #333;
          }
          .album-play-overlay {
            display: none;
          }
          .album-title {
            font-size: 14px;
          }
          .album-artist {
            font-size: 12px;
          }
        }

        @media (max-width: 480px) {
          .album-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .album-card {
            padding: 10px;
          }
        }
      `}</style>
      <div className="album-grid">
        {albums.map((album) => {
          const key = `${album.album}:${album.artist}`;

          return (
            <div
              key={key}
              className="album-card"
              onClick={() => onSelect(album)}
            >
              <div className="album-cover-wrapper">
                {album.coverId ? (
                  <img src={`/api/cover/${album.coverId}`} alt="" className="album-cover-img" />
                ) : (
                  <div className="album-cover">&#128191;</div>
                )}
                <div className="album-play-overlay">▶</div>
              </div>
              <div className="album-title">{album.album}</div>
              <div className="album-artist">{album.artist}</div>
              {(album.year || album.trackCount) && (
                <div className="album-meta">
                  {album.year && `${album.year}`}
                  {album.year && album.trackCount && ' · '}
                  {album.trackCount && `${album.trackCount} tracks`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
