import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { env } from '../config/env.js';
import { createLogger, type TranscriptionEvent } from '@cock/shared';

const log = createLogger('deepgram-stt');

/**
 * Real-time Speech-to-Text via Deepgram streaming (raw WebSocket, no SDK)
 *
 * Uses Deepgram's WebSocket API directly — no SDK version dependency issues.
 */
export class DeepgramSTTService extends EventEmitter {
  private ws: WebSocket | null = null;
  private callSid: string;

  constructor(callSid: string) {
    super();
    this.callSid = callSid;
  }

  connect() {
    const url = new URL('wss://api.deepgram.com/v1/listen');
    url.searchParams.set('model', 'nova-3');
    url.searchParams.set('language', 'multi');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('interim_results', 'true');
    url.searchParams.set('endpointing', '800');
    url.searchParams.set('utterance_end_ms', '2500');
    url.searchParams.set('vad_events', 'true');
    url.searchParams.set('encoding', 'linear16');
    url.searchParams.set('sample_rate', '16000');
    url.searchParams.set('channels', '1');

    this.ws = new WebSocket(url.toString(), {
      headers: {
        Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      },
    });

    this.ws.on('open', () => {
      log.info('Deepgram stream connected', undefined, this.callSid);
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'Results') {
          const transcript = msg.channel?.alternatives?.[0];
          if (!transcript) return;

          const event: TranscriptionEvent = {
            transcript: transcript.transcript || '',
            confidence: transcript.confidence || 0,
            isFinal: msg.is_final === true,
            words: transcript.words?.map((w: any) => ({
              word: w.word,
              start: w.start,
              end: w.end,
              confidence: w.confidence,
            })),
          };

          if (event.transcript.trim()) {
            this.emit('transcript', event);
          }

          if (msg.speech_final) {
            this.emit('speech_end');
          }
        }

        if (msg.type === 'UtteranceEnd') {
          this.emit('utterance_end');
        }
      } catch (err) {
        log.error('Deepgram message parse error', { error: String(err) }, this.callSid);
      }
    });

    this.ws.on('error', (error: Error) => {
      log.error('Deepgram error', { error: String(error) }, this.callSid);
      this.emit('error', new Error(`Deepgram connection error: ${error.message}`));
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason.toString();
      log.info('Deepgram stream closed', { code, reason: reasonStr }, this.callSid);

      if (code === 4001 || code === 4002 || code === 4003) {
        this.emit('error', new Error('Deepgram API key invalid or expired'));
      } else if (code === 4008) {
        this.emit('error', new Error('Deepgram: request too large'));
      } else if (code >= 4000) {
        this.emit('error', new Error(`Deepgram error (${code}): ${reasonStr}`));
      }

      this.emit('close');
    });
  }

  /**
   * Send raw PCM audio (linear16, 16kHz, mono)
   */
  sendAudio(pcmBuffer: Buffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(pcmBuffer);
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
