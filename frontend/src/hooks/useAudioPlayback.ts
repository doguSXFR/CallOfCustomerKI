import { useRef, useState, useCallback } from 'react';
import { base64ToBlobUrl } from '../lib/audio-utils';

export type PlaybackStatus = 'idle' | 'playing';

export function useAudioPlayback() {
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const queueRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setStatus('idle');
      return;
    }

    const base64Chunk = queueRef.current.shift()!;
    const url = base64ToBlobUrl(base64Chunk, 'audio/mpeg');

    const audio = new Audio(url);
    audioRef.current = audio;
    isPlayingRef.current = true;
    setStatus('playing');

    audio.onended = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      playNext();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      playNext();
    };

    audio.play().catch(() => {
      playNext();
    });
  }, []);

  const enqueue = useCallback(
    (base64Audio: string) => {
      queueRef.current.push(base64Audio);
      if (!isPlayingRef.current) {
        playNext();
      }
    },
    [playNext],
  );

  const stop = useCallback(() => {
    queueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    isPlayingRef.current = false;
    setStatus('idle');
  }, []);

  return { status, enqueue, stop };
}
