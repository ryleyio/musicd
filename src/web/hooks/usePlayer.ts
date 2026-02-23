import { useState, useRef, useCallback, useEffect } from 'react';

export interface Track {
  id: number;
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  year: number | null;
  duration: number | null;
  genres: string | null;
  fileType: string | null;
  codec: string | null;
  coverId: number | null;
}

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  history: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    history: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  });

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => {
      setState(s => ({ ...s, currentTime: audio.currentTime }));
    });

    audio.addEventListener('durationchange', () => {
      // Only update if we get a valid finite duration
      if (isFinite(audio.duration) && audio.duration > 0) {
        setState(s => ({ ...s, duration: audio.duration }));
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      // Also check on loadedmetadata
      if (isFinite(audio.duration) && audio.duration > 0) {
        setState(s => ({ ...s, duration: audio.duration }));
      }
    });

    audio.addEventListener('ended', () => {
      setState(s => {
        if (s.queue.length > 0) {
          const [next, ...rest] = s.queue;
          audio.src = `/api/stream/${next.id}`;
          audio.play();
          const newHistory = s.currentTrack ? [...s.history, s.currentTrack] : s.history;
          const duration = next.duration && next.duration > 0 ? next.duration : 0;
          return { ...s, currentTrack: next, queue: rest, history: newHistory, isPlaying: true, duration, currentTime: 0 };
        }
        return { ...s, isPlaying: false };
      });
    });

    audio.addEventListener('play', () => {
      setState(s => ({ ...s, isPlaying: true }));
    });

    audio.addEventListener('pause', () => {
      setState(s => ({ ...s, isPlaying: false }));
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const play = useCallback((track: Track) => {
    if (!audioRef.current) return;
    audioRef.current.src = `/api/stream/${track.id}`;
    audioRef.current.play();
    setState(s => {
      const newHistory = s.currentTrack ? [...s.history, s.currentTrack] : s.history;
      // Use track's duration from metadata as initial value (fallback for chunked streams)
      const duration = track.duration && track.duration > 0 ? track.duration : 0;
      return { ...s, currentTrack: track, history: newHistory, isPlaying: true, duration, currentTime: 0 };
    });
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play();
  }, []);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [state.isPlaying, pause, resume]);

  const seek = useCallback((time: number) => {
    if (audioRef.current && isFinite(time) && time >= 0) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      setState(s => ({ ...s, volume }));
    }
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setState(s => ({ ...s, queue: [...s.queue, track] }));
  }, []);

  const playAlbum = useCallback((tracks: Track[]) => {
    if (tracks.length === 0) return;
    const [first, ...rest] = tracks;
    if (!audioRef.current) return;
    audioRef.current.src = `/api/stream/${first.id}`;
    audioRef.current.play();
    // Clear history when starting a new album, use track duration as fallback
    const duration = first.duration && first.duration > 0 ? first.duration : 0;
    setState(s => ({ ...s, currentTrack: first, queue: rest, history: [], isPlaying: true, duration, currentTime: 0 }));
  }, []);

  const playNext = useCallback(() => {
    setState(s => {
      if (s.queue.length > 0) {
        const [next, ...rest] = s.queue;
        if (audioRef.current) {
          audioRef.current.src = `/api/stream/${next.id}`;
          audioRef.current.play();
        }
        const newHistory = s.currentTrack ? [...s.history, s.currentTrack] : s.history;
        const duration = next.duration && next.duration > 0 ? next.duration : 0;
        return { ...s, currentTrack: next, queue: rest, history: newHistory, isPlaying: true, duration, currentTime: 0 };
      }
      return s;
    });
  }, []);

  const playPrev = useCallback(() => {
    setState(s => {
      // If we're more than 3 seconds into a song, restart it instead
      if (audioRef.current && audioRef.current.currentTime > 3) {
        audioRef.current.currentTime = 0;
        return { ...s, currentTime: 0 };
      }

      if (s.history.length > 0) {
        const prev = s.history[s.history.length - 1];
        const newHistory = s.history.slice(0, -1);
        // Add current track to front of queue
        const newQueue = s.currentTrack ? [s.currentTrack, ...s.queue] : s.queue;
        if (audioRef.current) {
          audioRef.current.src = `/api/stream/${prev.id}`;
          audioRef.current.play();
        }
        const duration = prev.duration && prev.duration > 0 ? prev.duration : 0;
        return { ...s, currentTrack: prev, queue: newQueue, history: newHistory, isPlaying: true, duration, currentTime: 0 };
      }
      // No history - just restart current track
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      return { ...s, currentTime: 0 };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState(s => ({ ...s, queue: [] }));
  }, []);

  return {
    ...state,
    play,
    pause,
    resume,
    togglePlay,
    seek,
    setVolume,
    addToQueue,
    playAlbum,
    playNext,
    playPrev,
    clearQueue,
  };
}
