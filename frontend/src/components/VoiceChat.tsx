import { useState, useCallback, useEffect, useRef } from 'react';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import { useVoiceWebSocket } from '../hooks/useVoiceWebSocket';
import { Waveform } from './Waveform';
import { ChatLog } from './ChatLog';
import { StatusIndicator } from './StatusIndicator';
import type { VoiceStatus } from './StatusIndicator';

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/voice/stream`;

export function VoiceChat() {
  const [mode, setMode] = useState<'ptt' | 'toggle'>('ptt');
  const [isRecording, setIsRecording] = useState(false);
  const playbackAttached = useRef(false);

  const {
    wsStatus,
    messages,
    pipelineStatus,
    connect,
    disconnect,
    sendAudio,
    sendEndOfSpeech,
    onAudio,
  } = useVoiceWebSocket(WS_URL);

  const playback = useAudioPlayback();

  const onAudioData = useCallback(
    (base64Pcm: string) => {
      sendAudio(base64Pcm);
    },
    [sendAudio],
  );

  const capture = useAudioCapture({ onAudioData });

  // Wire server audio → playback
  useEffect(() => {
    if (playbackAttached.current) return;
    playbackAttached.current = true;
    onAudio((base64) => {
      playback.enqueue(base64);
    });
  }, [onAudio, playback]);

  // Derive UI status
  const status: VoiceStatus = (() => {
    if (capture.status === 'recording') return 'listening';
    if (pipelineStatus === 'processing' || pipelineStatus === 'llm') return 'processing';
    if (playback.status === 'playing') return 'speaking';
    return 'idle';
  })();

  const handleStart = useCallback(async () => {
    if (wsStatus !== 'connected') connect();
    await capture.start();
    setIsRecording(true);
  }, [wsStatus, connect, capture]);

  const handleStop = useCallback(() => {
    capture.stop();
    sendEndOfSpeech();
    setIsRecording(false);
  }, [capture, sendEndOfSpeech]);

  const handleToggle = useCallback(async () => {
    if (isRecording) {
      handleStop();
    } else {
      await handleStart();
    }
  }, [isRecording, handleStart, handleStop]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6">
      <h1 className="text-2xl font-bold tracking-tight">
        C.O.C.K <span className="text-gray-500 text-base font-normal">Voice Chat</span>
      </h1>

      <StatusIndicator status={status} />

      <Waveform analyserNode={capture.analyserNode} active={isRecording} />

      {/* Connection status */}
      <div className="text-[10px] text-gray-600 uppercase tracking-widest">
        {wsStatus === 'connected' ? '● Verbunden' : wsStatus === 'connecting' ? '◐ Verbindet...' : '○ Getrennt'}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setMode('ptt')}
          className={`px-3 py-1 rounded-full transition ${
            mode === 'ptt' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Push-to-Talk
        </button>
        <button
          onClick={() => setMode('toggle')}
          className={`px-3 py-1 rounded-full transition ${
            mode === 'toggle' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Toggle
        </button>
      </div>

      {/* Talk button */}
      {mode === 'ptt' ? (
        <button
          onMouseDown={handleStart}
          onMouseUp={handleStop}
          onTouchStart={handleStart}
          onTouchEnd={handleStop}
          className={`w-24 h-24 rounded-full text-3xl font-bold transition-all select-none ${
            isRecording
              ? 'bg-red-600 scale-110 shadow-lg shadow-red-600/40'
              : 'bg-red-700 hover:bg-red-600 active:scale-105'
          }`}
        >
          🎙
        </button>
      ) : (
        <button
          onClick={handleToggle}
          className={`w-24 h-24 rounded-full text-3xl font-bold transition-all select-none ${
            isRecording
              ? 'bg-red-600 scale-110 shadow-lg shadow-red-600/40 animate-pulse'
              : 'bg-gray-700 hover:bg-gray-600 active:scale-105'
          }`}
        >
          {isRecording ? '⏹' : '🎙'}
        </button>
      )}

      {/* Chat log */}
      <div className="w-full">
        <ChatLog messages={messages} />
      </div>

      {/* Disconnect button */}
      {wsStatus === 'connected' && (
        <button onClick={disconnect} className="text-xs text-gray-600 hover:text-gray-400">
          Trennen
        </button>
      )}
    </div>
  );
}
