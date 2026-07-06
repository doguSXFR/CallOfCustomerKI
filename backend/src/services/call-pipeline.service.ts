import { EventEmitter } from 'events';
import { DeepgramSTTService } from './deepgram-stt.service.js';
import { ElevenLabsTTSService } from './elevenlabs-tts.service.js';
import { streamLLMResponse } from './openai-llm.service.js';
import { mulawToLinear16 } from '@cock/shared';
import { createLogger, type ConversationMessage, type PipelineEvent } from '@cock/shared';
import { SILENCE_TIMEOUT_MS, PROCESSING_TIMEOUT_MS } from '@cock/shared';

const log = createLogger('pipeline');

/**
 * The Call Pipeline orchestrates the full voice AI loop:
 *
 *   Audio In (Twilio) → STT (Deepgram) → LLM (OpenAI) → TTS (ElevenLabs) → Audio Out (Twilio)
 *
 * Usage:
 *   const pipeline = new CallPipelineService(callSid);
 *   pipeline.on('audio_out', (buffer) => sendToTwilio(buffer));
 *   pipeline.start();
 *   pipeline.feedAudio(mulawBuffer); // raw from Twilio
 */
export class CallPipelineService extends EventEmitter {
  private callSid: string;
  private stt: DeepgramSTTService;
  private tts: ElevenLabsTTSService;
  private messages: ConversationMessage[] = [];
  private isProcessing = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(callSid: string) {
    super();
    this.callSid = callSid;
    this.stt = new DeepgramSTTService(callSid);
    this.tts = new ElevenLabsTTSService(callSid);
  }

  start() {
    log.info('Pipeline starting', undefined, this.callSid);

    // STT → on final transcript → send to LLM
    this.stt.on('transcript', (event) => {
      if (event.isFinal && event.transcript.trim()) {
        log.info('User said', { text: event.transcript }, this.callSid);
        this.handleUserSpeech(event.transcript);
      }
    });

    this.stt.on('error', (error) => {
      log.error('STT error', { error: String(error) }, this.callSid);
      this.emit('pipeline_event', {
        type: 'error',
        callSid: this.callSid,
        timestamp: Date.now(),
        error: `STT: ${String(error)}`,
      } as PipelineEvent);
    });

    // TTS → audio chunks → send back to Twilio
    this.tts.on('audio_chunk', (buffer: Buffer) => {
      this.emit('audio_out', buffer);
    });

    this.tts.on('done', () => {
      log.info('TTS playback complete', undefined, this.callSid);
      this.emit('pipeline_event', { type: 'tts_end', callSid: this.callSid, timestamp: Date.now() } as PipelineEvent);
      this.resetSilenceTimer();
    });

    this.tts.on('error', (error) => {
      log.error('TTS error', { error: String(error) }, this.callSid);
    });

    // Connect to Deepgram
    this.stt.connect();
    this.resetSilenceTimer();
  }

  /**
   * Feed raw mulaw audio from Twilio Media Streams
   */
  feedAudio(mulawBase64: string) {
    // Convert Twilio's mulaw 8kHz → linear16 16kHz for Deepgram
    const linear16 = mulawToLinear16(mulawBase64);
    this.stt.sendAudio(linear16);
    this.resetSilenceTimer();
  }

  private async handleUserSpeech(transcript: string) {
    if (this.isProcessing) return; // Skip if already processing
    this.isProcessing = true;
    this.clearSilenceTimer();

    // Add user message
    this.messages.push({
      role: 'user',
      content: transcript,
      timestamp: Date.now(),
    });

    this.emit('pipeline_event', { type: 'llm_start', callSid: this.callSid, timestamp: Date.now() } as PipelineEvent);

    try {
      // Stream LLM response
      let fullResponse = '';
      const processingTimeout = setTimeout(() => {
        log.warn('LLM processing timeout', undefined, this.callSid);
      }, PROCESSING_TIMEOUT_MS);

      for await (const chunk of streamLLMResponse(this.messages)) {
        if (chunk.content) {
          fullResponse += chunk.content;
        }
        if (chunk.isComplete) {
          clearTimeout(processingTimeout);

          if (fullResponse.trim()) {
            // Add assistant message
            this.messages.push({
              role: 'assistant',
              content: fullResponse,
              timestamp: Date.now(),
            });

            log.info('Agent said', { text: fullResponse }, this.callSid);

            // Synthesize speech
            this.emit('pipeline_event', { type: 'tts_start', callSid: this.callSid, timestamp: Date.now() } as PipelineEvent);
            await this.tts.synthesize(fullResponse);
          }
        }
      }
    } catch (error) {
      log.error('Pipeline error', { error: String(error) }, this.callSid);
    } finally {
      this.isProcessing = false;
      this.resetSilenceTimer();
    }
  }

  private resetSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (!this.isProcessing) {
        log.info('Silence timeout — prompting user', undefined, this.callSid);
        // Optional: send a "are you still there?" prompt
        // this.handleUserSpeech('[System: Der Kunde ist seit 30 Sekunden still]');
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
    log.info('Pipeline stopping', undefined, this.callSid);
    this.clearSilenceTimer();
    this.stt.close();
    this.removeAllListeners();
  }

  getMessages(): ConversationMessage[] {
    return [...this.messages];
  }
}
