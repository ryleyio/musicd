import React from 'react';

interface Artist {
  name: string;
  trackCount: number;
}

interface ArtistListProps {
  artists: Artist[];
  onSelect: (artist: string) => void;
}

export default function ArtistList({ artists, onSelect }: ArtistListProps) {
  return (
    <>
      <style>{`
        .artist-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 20px;
        }
        .artist-card {
          background: #181818;
          border-radius: 8px;
          padding: 20px;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
          text-align: center;
        }
        .artist-card:hover {
          background: #282828;
          transform: translateY(-2px);
        }
        .artist-card:active {
          transform: scale(0.98);
        }
        .artist-avatar {
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, #333 0%, #1a1a1a 100%);
          border-radius: 50%;
          margin: 0 auto 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          color: #666;
          transition: transform 0.2s;
        }
        .artist-card:hover .artist-avatar {
          transform: scale(1.05);
        }
        .artist-name {
          font-weight: bold;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .artist-count {
          color: #999;
          font-size: 14px;
        }

        /* ===== MOBILE STYLES ===== */
        @media (max-width: 768px) {
          .artist-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 12px;
          }
          .artist-card {
            padding: 15px;
          }
          .artist-card:hover {
            transform: none;
          }
          .artist-avatar {
            width: 80px;
            height: 80px;
            font-size: 32px;
          }
          .artist-card:hover .artist-avatar {
            transform: none;
          }
          .artist-name {
            font-size: 14px;
          }
          .artist-count {
            font-size: 12px;
          }
        }

        @media (max-width: 480px) {
          .artist-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .artist-card {
            padding: 12px;
          }
          .artist-avatar {
            width: 60px;
            height: 60px;
            font-size: 24px;
            margin-bottom: 10px;
          }
        }
      `}</style>
      <div className="artist-grid">
        {artists.map((artist) => (
          <div
            key={artist.name}
            className="artist-card"
            onClick={() => onSelect(artist.name)}
          >
            <div className="artist-avatar">🎤</div>
            <div className="artist-name">{artist.name}</div>
            <div className="artist-count">{artist.trackCount} tracks</div>
          </div>
        ))}
      </div>
    </>
  );
}
