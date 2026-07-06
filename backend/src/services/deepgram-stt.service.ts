import { createClient, LiveTranscriptionEvents, type LiveClient } from '@deepgram/sdk';
import { EventEmitter } from 'events';
import { env } from '../config/env.js';
import { createLogger, type TranscriptionEvent } from '@cock/shared';

const log = createLogger('deepgram-stt');

/**
 * Real-time Speech-to-Text via Deepgram streaming
 *
 * Usage:
 *   const stt = new DeepgramSTTService();
 *   stt.connect();
 *   stt.on('transcript', (event) => console.log(event.transcript));
 *   stt.sendAudio(pcmBuffer); // linear16 16kHz
 *   stt.close();
 */
export class DeepgramSTTService extends EventEmitter {
  private client: ReturnType<typeof createClient>;
  private connection: LiveClient | null = null;
  private callSid: string;

  constructor(callSid: string) {
    super();
    this.callSid = callSid;
    this.client = createClient(env.DEEPGRAM_API_KEY);
  }

  connect() {
    this.connection = this.client.listen.live({
      model: 'nova-3',
      language: 'multi', // auto-detect language
      smart_format: true,
      interim_results: true,
      endpointing: 300, // 300ms silence = end of speech
      utterance_end_ms: 1000,
      vad_events: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
    });

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      log.info('Deepgram stream connected', undefined, this.callSid);
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const transcript = data.channel?.alternatives?.[0];
      if (!transcript) return;

      const event: TranscriptionEvent = {
        transcript: transcript.transcript || '',
        confidence: transcript.confidence || 0,
        isFinal: data.is_final === true,
        words: transcript.words?.map((w: any) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
        })),
      };

      // Only emit non-empty transcripts
      if (event.transcript.trim()) {
        this.emit('transcript', event);
      }

      if (data.speech_final) {
        this.emit('speech_end');
      }
    });

    this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      this.emit('utterance_end');
    });

    this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
      log.error('Deepgram error', { error: String(error) }, this.callSid);
      this.emit('error', error);
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      log.info('Deepgram stream closed', undefined, this.callSid);
      this.emit('close');
    });
  }

  /**
   * Send raw PCM audio (linear16, 16kHz, mono)
   */
  sendAudio(pcmBuffer: Buffer) {
    if (this.connection) {
      this.connection.send(pcmBuffer);
    }
  }

  close() {
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }
  }
}
