import { useRef, useState, useCallback } from 'react';
import { pcm16Base64ToAudioBuffer, base64ToBlobUrl } from '../lib/audio-utils';

export type PlaybackStatus = 'idle' | 'playing';

interface QueueEntry {
  data: string;
  format: 'mp3' | 'pcm16';
}

export function useAudioPlayback() {
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const queueRef = useRef<QueueEntry[]>([]);
  const isPlayingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scheduledUntilRef = useRef(0);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: 16000 });
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setStatus('idle');
      return;
    }

    const entry = queueRef.current.shift()!;
    isPlayingRef.current = true;
    setStatus('playing');

    if (entry.format === 'pcm16') {
      try {
        const ctx = getAudioContext();
        const audioBuffer = pcm16Base64ToAudioBuffer(entry.data, ctx);
        console.log('[PLAYBACK] AudioBuffer created', audioBuffer.duration, 'seconds');

        const startTime = Math.max(ctx.currentTime, scheduledUntilRef.current);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        console.log('[PLAYBACK] playing AudioBuffer');
        source.start(startTime);
        scheduledUntilRef.current = startTime + audioBuffer.duration;

        source.onended = () => playNext();
      } catch (err) {
        console.log('[PLAYBACK] error during playback', err);
        playNext();
      }
    } else {
      const url = base64ToBlobUrl(entry.data, 'audio/mpeg');
      const audio = new Audio(url);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        playNext();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        playNext();
      };

      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        playNext();
      });
    }
  }, [getAudioContext]);

  const enqueue = useCallback(
    (base64Audio: string, format: 'mp3' | 'pcm16' = 'mp3') => {
      console.log('[PLAYBACK] enqueue called', format, base64Audio.length);
      queueRef.current.push({ data: base64Audio, format });
      if (!isPlayingRef.current) {
        playNext();
      }
    },
    [playNext],
  );

  const stop = useCallback(() => {
    queueRef.current = [];
    scheduledUntilRef.current = 0;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    isPlayingRef.current = false;
    setStatus('idle');
  }, []);

  return { status, enqueue, stop };
}
