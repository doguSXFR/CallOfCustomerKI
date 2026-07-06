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
  const [pipelineStatus, setPipelineStatus] = useState<string>('idle');

  const wsRef = useRef<WebSocket | null>(null);
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
            setMessages((prev) => [
              ...prev,
              { role: msg.role, text: msg.text, timestamp: Date.now() },
            ]);
            break;
          case 'audio':
            // handled by onAudio callback
            break;
          case 'status':
            setPipelineStatus(msg.status);
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

  const onAudio = useCallback((callback: (base64: string) => void) => {
    const ws = wsRef.current;
    if (!ws) return;

    const handler = (event: MessageEvent) => {
      try {
        const msg: VoiceWSMessage = JSON.parse(event.data);
        if (msg.type === 'audio') {
          callback(msg.data);
        }
      } catch {
        // ignore
      }
    };

    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    wsStatus,
    messages,
    pipelineStatus,
    connect,
    disconnect,
    sendAudio,
    sendEndOfSpeech,
    onAudio,
  };
}
