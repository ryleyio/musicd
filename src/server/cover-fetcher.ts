// MusicBrainz Cover Art Archive fetcher
// Rate limited to 1 request/second per MusicBrainz guidelines

interface MusicBrainzRelease {
  id: string;
  title: string;
  score: number;
  'artist-credit'?: Array<{ name: string }>;
}

interface MusicBrainzSearchResult {
  releases?: MusicBrainzRelease[];
}

export interface FetchedCover {
  data: Buffer;
  mimeType: string;
  source: string;
}

// Simple rate limiter - tracks last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();
  return fetch(url, options);
}

// Search MusicBrainz for a release matching artist + album
async function searchMusicBrainz(artist: string, album: string): Promise<string | null> {
  const query = encodeURIComponent(`artist:"${artist}" AND release:"${album}"`);
  const url = `https://musicbrainz.org/ws/2/release/?query=${query}&fmt=json&limit=5`;

  const response = await rateLimitedFetch(url, {
    headers: {
      'User-Agent': 'musicd/1.0.0 (https://github.com/musicd)',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    console.error(`MusicBrainz search failed: ${response.status}`);
    return null;
  }

  const data: MusicBrainzSearchResult = await response.json();

  if (!data.releases || data.releases.length === 0) {
    return null;
  }

  // Return the best match (highest score)
  return data.releases[0].id;
}

// Fetch cover from Cover Art Archive
async function fetchCoverFromArchive(mbid: string): Promise<FetchedCover | null> {
  // Try to get the front cover at 500px
  const url = `https://coverartarchive.org/release/${mbid}/front-500`;

  const response = await rateLimitedFetch(url, {
    headers: {
      'User-Agent': 'musicd/1.0.0 (https://github.com/musicd)'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      // No cover available for this release
      return null;
    }
    console.error(`Cover Art Archive fetch failed: ${response.status}`);
    return null;
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const data = Buffer.from(arrayBuffer);

  return {
    data,
    mimeType: contentType,
    source: 'musicbrainz'
  };
}

// Main function to fetch album cover
export async function fetchAlbumCover(artist: string, album: string): Promise<FetchedCover | null> {
  try {
    // Step 1: Search MusicBrainz for the release
    const mbid = await searchMusicBrainz(artist, album);
    if (!mbid) {
      console.log(`No MusicBrainz release found for "${artist}" - "${album}"`);
      return null;
    }

    // Step 2: Fetch cover from Cover Art Archive
    const cover = await fetchCoverFromArchive(mbid);
    if (!cover) {
      console.log(`No cover art found for MBID ${mbid}`);
      return null;
    }

    console.log(`Successfully fetched cover for "${artist}" - "${album}"`);
    return cover;
  } catch (error) {
    console.error(`Error fetching cover for "${artist}" - "${album}":`, error);
    return null;
  }
}
