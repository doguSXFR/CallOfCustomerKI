import { EventEmitter } from 'events';
import { DeepgramSTTService } from './deepgram-stt.service.js';
import { ElevenLabsTTSService } from './elevenlabs-tts.service.js';
import { streamLLMResponse } from './openai-llm.service.js';
import { createLogger, type ConversationMessage, type PipelineEvent } from '@cock/shared';
import { SILENCE_TIMEOUT_MS, PROCESSING_TIMEOUT_MS } from '@cock/shared';

const log = createLogger('voice-pipeline');

/**
 * Voice pipeline for browser audio (PCM 16kHz mono).
 *
 * Differs from CallPipelineService (Twilio):
 *   - No mulaw conversion needed — browser sends raw PCM16
 *   - TTS audio is sent back as base64 MP3 chunks (not mulaw for Twilio)
 */
export class VoicePipelineService extends EventEmitter {
  private sessionId: string;
  private stt: DeepgramSTTService;
  private tts: ElevenLabsTTSService;
  private messages: ConversationMessage[] = [];
  private isProcessing = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
    this.stt = new DeepgramSTTService(sessionId);
    this.tts = new ElevenLabsTTSService(sessionId);
  }

  start() {
    log.info('Voice pipeline starting', undefined, this.sessionId);

    this.stt.on('transcript', (event) => {
      if (event.isFinal && event.transcript.trim()) {
        log.info('User said', { text: event.transcript }, this.sessionId);
        this.emit('transcript', { text: event.transcript, role: 'user' });
        this.handleUserSpeech(event.transcript);
      }
    });

    this.stt.on('error', (error) => {
      log.error('STT error', { error: String(error) }, this.sessionId);
      this.emit('error', `STT: ${String(error)}`);
    });

    this.tts.on('audio_chunk', (buffer: Buffer) => {
      this.emit('audio_chunk', buffer);
    });

    this.tts.on('done', () => {
      log.info('TTS playback complete', undefined, this.sessionId);
      this.emit('status', 'idle');
      this.resetSilenceTimer();
    });

    this.tts.on('error', (error) => {
      log.error('TTS error', { error: String(error) }, this.sessionId);
    });

    this.stt.connect();
    this.emit('status', 'listening');
    this.resetSilenceTimer();
  }

  /**
   * Feed raw PCM16 16kHz audio from the browser (already in the right format).
   */
  feedAudio(pcmBuffer: Buffer) {
    this.stt.sendAudio(pcmBuffer);
    this.resetSilenceTimer();
  }

  private async handleUserSpeech(transcript: string) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.clearSilenceTimer();
    this.emit('status', 'processing');

    this.messages.push({
      role: 'user',
      content: transcript,
      timestamp: Date.now(),
    });

    try {
      let fullResponse = '';
      const timeout = setTimeout(() => {
        log.warn('LLM processing timeout', undefined, this.sessionId);
      }, PROCESSING_TIMEOUT_MS);

      for await (const chunk of streamLLMResponse(this.messages)) {
        if (chunk.content) {
          fullResponse += chunk.content;
        }
        if (chunk.isComplete) {
          clearTimeout(timeout);

          if (fullResponse.trim()) {
            this.messages.push({
              role: 'assistant',
              content: fullResponse,
              timestamp: Date.now(),
            });

            log.info('Agent said', { text: fullResponse }, this.sessionId);
            this.emit('transcript', { text: fullResponse, role: 'assistant' });
            this.emit('status', 'speaking');
            await this.tts.synthesize(fullResponse);
          }
        }
      }
    } catch (error) {
      log.error('Pipeline error', { error: String(error) }, this.sessionId);
      this.emit('error', String(error));
    } finally {
      this.isProcessing = false;
      this.resetSilenceTimer();
    }
  }

  private resetSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (!this.isProcessing) {
        log.info('Silence timeout', undefined, this.sessionId);
      }
    }, SILENCE_TIMEOUT_MS);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  stop() {
    log.info('Voice pipeline stopping', undefined, this.sessionId);
    this.clearSilenceTimer();
    this.stt.close();
    this.removeAllListeners();
  }

  getMessages(): ConversationMessage[] {
    return [...this.messages];
  }
}
