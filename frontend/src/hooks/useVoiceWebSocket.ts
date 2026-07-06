import { useRef, useState, useCallback, useEffect } from 'react';
import type { VoiceWSMessage, VoiceWSSendMessage } from '../lib/websocket';

export type WSStatus = 'disconnected' | 'connecting' | 'connected';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export function useVoiceWebSocket(url: string) {
  const [wsStatus, setWsStatus] = useState<WSStatus>('disconnected');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interimText, setInterimText] = useState<string>('');
  const [pipelineStatus, setPipelineStatus] = useState<string>('idle');
  const [_ttsProvider, setTtsProvider] = useState<string | null>(null);
  const [_ttsModel, setTtsModel] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCallbackRef = useRef<((base64: string, format?: 'mp3' | 'pcm16') => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: VoiceWSMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'transcript':
            if (msg.interim) {
              setInterimText(msg.text);
            } else {
              setInterimText('');
              setMessages((prev) => [
                ...prev,
                { role: msg.role, text: msg.text, timestamp: Date.now() },
              ]);
            }
            break;
          case 'audio':
            console.log('[WS-CLIENT] audio message received', msg.format, msg.data.length);
            if (audioCallbackRef.current) {
              audioCallbackRef.current(msg.data, msg.format);
            } else {
              console.log('[WS-CLIENT] WARNING: no audio callback registered!');
            }
            break;
          case 'status':
            setPipelineStatus(msg.status);
            break;
          case 'config':
            setTtsProvider(msg.ttsProvider);
            setTtsModel(msg.model);
            break;
          case 'error':
            console.error('Server error:', msg.error);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      setPipelineStatus('idle');
      setTtsProvider(null);
      setTtsModel(null);
      reconnectTimerRef.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus('disconnected');
    setInterimText('');
  }, []);

  const sendAudio = useCallback((base64Pcm: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: VoiceWSSendMessage = { type: 'audio', data: base64Pcm };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendEndOfSpeech = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: VoiceWSSendMessage = { type: 'end_of_speech' };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const onAudio = useCallback((callback: (base64: string, format?: 'mp3' | 'pcm16') => void) => {
    audioCallbackRef.current = callback;
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    wsStatus,
    messages,
    interimText,
    pipelineStatus,
    ttsProvider: _ttsProvider,
    ttsModel: _ttsModel,
    connect,
    disconnect,
    sendAudio,
    sendEndOfSpeech,
    onAudio,
  };
}
