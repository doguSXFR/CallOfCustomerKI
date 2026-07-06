import { useState, useCallback, useEffect, useRef } from 'react';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import { useVoiceWebSocket } from '../hooks/useVoiceWebSocket';
import { Waveform } from './Waveform';
import { ChatLog } from './ChatLog';
import { StatusIndicator } from './StatusIndicator';
import type { VoiceStatus } from './StatusIndicator';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Mic, MicOff, PhoneOff } from 'lucide-react';

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/voice/stream`;

export function VoiceChat() {
  const [isRecording, setIsRecording] = useState(false);
  const playbackAttached = useRef(false);

  const {
    wsStatus,
    messages,
    interimText,
    pipelineStatus,
    ttsProvider,
    ttsModel,
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

  useEffect(() => {
    if (playbackAttached.current) return;
    playbackAttached.current = true;
    onAudio((base64) => {
      playback.enqueue(base64);
    });
  }, [onAudio, playback]);

  const status: VoiceStatus = (() => {
    if (capture.status === 'error') return 'idle';
    if (capture.status === 'recording') return 'listening';
    if (pipelineStatus === 'processing' || pipelineStatus === 'llm') return 'processing';
    if (playback.status === 'playing') return 'speaking';
    return 'idle';
  })();

  const handleStart = useCallback(async () => {
    if (wsStatus !== 'connected') connect();
    await capture.start();
    if (capture.status !== 'error') {
      setIsRecording(true);
    }
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

  const isConnected = wsStatus === 'connected';
  const isConnecting = wsStatus === 'connecting';

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-8 p-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">C.O.C.K</h1>
        <p className="text-muted-foreground text-sm">AI Voice Assistant</p>
      </div>

      <Card className="w-full">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center">
            <StatusIndicator status={status} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <Waveform analyserNode={capture.analyserNode} active={isRecording} />

          <div className="relative">
            {isRecording && (
              <>
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse-ring" />
                <div className="absolute inset-0 rounded-full bg-red-500/10 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
              </>
            )}
            <Button
              onClick={handleToggle}
              disabled={isConnecting || capture.status === 'error'}
              size="lg"
              className={`w-32 h-32 rounded-full text-4xl ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700'
                  : ''
              }`}
            >
              {isRecording ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
            </Button>
          </div>

          {capture.errorMessage ? (
            <p className="text-sm text-destructive">{capture.errorMessage}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isConnecting ? 'Verbindet...' : isRecording ? 'Klicke zum Stoppen' : 'Klicke zum Sprechen'}
            </p>
          )}

          <Badge variant={isConnected ? 'success' : isConnecting ? 'warning' : 'secondary'}>
            {isConnected ? 'Verbunden' : isConnecting ? 'Verbindet...' : 'Getrennt'}
          </Badge>
          {isConnected && ttsProvider && (
            <p className="text-xs text-muted-foreground mt-1">
              TTS: {ttsProvider} <span className="opacity-60">({ttsModel})</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Chat Verlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {interimText && (
            <div className="mb-3 flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-sm bg-primary/40 text-primary-foreground/60">
                <span className="text-[10px] opacity-60 block mb-1 font-medium uppercase tracking-wider">
                  Du
                </span>
                <p className="leading-relaxed italic">{interimText}</p>
              </div>
            </div>
          )}
          <ChatLog messages={messages} />
        </CardContent>
      </Card>

      {isConnected && (
        <Button variant="ghost" size="sm" onClick={disconnect} className="text-muted-foreground">
          <PhoneOff className="w-4 h-4 mr-2" />
          Verbindung trennen
        </Button>
      )}
    </div>
  );
}
