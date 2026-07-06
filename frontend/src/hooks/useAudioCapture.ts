import { useRef, useState, useCallback, useEffect } from 'react';
import { float32ToPcm16, pcm16ToBase64 } from '../lib/audio-utils';

export type CaptureStatus = 'idle' | 'recording' | 'error';

export interface UseAudioCaptureOptions {
  sampleRate?: number;
  onAudioData?: (base64Pcm: string) => void;
}

export function useAudioCapture(options: UseAudioCaptureOptions = {}) {
  const { sampleRate = 16000, onAudioData } = options;
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const onAudioDataRef = useRef(onAudioData);

  useEffect(() => {
    onAudioDataRef.current = onAudioData;
  }, [onAudioData]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      setAnalyserNode(analyser);

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        const pcm16 = float32ToPcm16(float32, ctx.sampleRate, sampleRate);
        const base64 = pcm16ToBase64(pcm16);
        onAudioDataRef.current?.(base64);
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setStatus('recording');
    } catch (err) {
      console.error('Audio capture error:', err);
      setStatus('error');
    }
  }, [sampleRate]);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
    }
    audioContextRef.current = null;

    setAnalyserNode(null);
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { status, start, stop, analyserNode };
}
