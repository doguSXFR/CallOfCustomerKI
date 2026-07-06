import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { VoicePipelineService } from '../services/voice-pipeline.service.js';
import { createLogger } from '@cock/shared';
import type { VoiceStreamInMessage, VoiceStreamOutMessage } from '@cock/shared';

const log = createLogger('voice-stream');

/**
 * Handle a browser voice stream WebSocket connection.
 *
 * Protocol:
 *   Browser → Server: { type: 'audio', data: '<base64 PCM16 16kHz>' }
 *   Browser → Server: { type: 'end_of_speech' }
 *   Server → Browser: { type: 'config', ttsProvider: '...', model: '...' }
 *   Server → Browser: { type: 'audio', data: '<base64 MP3>' }
 *   Server → Browser: { type: 'transcript', text: '...', role: 'user'|'assistant' }
 *   Server → Browser: { type: 'status', status: 'idle'|'listening'|'processing'|'speaking' }
 *   Server → Browser: { type: 'error', error: '...' }
 */
export function handleVoiceStream(ws: WebSocket) {
  const sessionId = randomUUID();
  const pipeline = new VoicePipelineService(sessionId);

  log.info('Browser voice stream connected', { sessionId });

  function send(msg: VoiceStreamOutMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // Send config to browser immediately on connect
  send({ type: 'config', ttsProvider: 'ElevenLabs', model: 'eleven_turbo_v2_5' });

  // Pipeline → Browser events
  pipeline.on('audio_chunk', (buffer: Buffer) => {
    send({ type: 'audio', data: buffer.toString('base64') });
  });

  pipeline.on('transcript', (event: { text: string; role: 'user' | 'assistant'; interim?: boolean }) => {
    send({ type: 'transcript', text: event.text, role: event.role, interim: event.interim });
  });

  pipeline.on('status', (status: string) => {
    send({ type: 'status', status: status as VoiceStreamOutMessage & { type: 'status' } extends { status: infer S } ? S : never });
  });

  pipeline.on('error', (error: string) => {
    send({ type: 'error', error });
  });

  // Start the pipeline
  pipeline.start();

  // Browser → Server messages
  ws.on('message', (raw: Buffer) => {
    try {
      const msg: VoiceStreamInMessage = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'audio': {
          const pcmBuffer = Buffer.from(msg.data, 'base64');
          pipeline.feedAudio(pcmBuffer);
          break;
        }
        case 'end_of_speech':
          log.info('End of speech signal received', undefined, sessionId);
          break;
      }
    } catch (err) {
      log.error('Message parse error', { error: String(err) }, sessionId);
    }
  });

  ws.on('close', () => {
    log.info('Browser voice stream disconnected', { sessionId });
    pipeline.stop();
  });

  ws.on('error', (error) => {
    log.error('WebSocket error', { error: String(error) }, sessionId);
    pipeline.stop();
  });
}
