import { EventEmitter } from 'events';
import { DeepgramSTTService } from './deepgram-stt.service.js';
import { ElevenLabsTTSService } from './elevenlabs-tts.service.js';
import { MiniMaxTTSService } from './minimax-tts.service.js';
import { env } from '../config/env.js';
import { streamLLMResponse } from './openai-llm.service.js';
import { createLogger, type ConversationMessage, type PipelineEvent } from '@cock/shared';
import { SILENCE_TIMEOUT_MS, PROCESSING_TIMEOUT_MS } from '@cock/shared';

const log = createLogger('voice-pipeline');

/** Union type for TTS services — both share the same EventEmitter interface */
type TTSService = ElevenLabsTTSService | MiniMaxTTSService;

/**
 * Voice pipeline for browser audio (PCM 16kHz mono).
 *
 * Differs from CallPipelineService (Twilio):
 *   - No mulaw conversion needed — browser sends raw PCM16
 *   - TTS audio is sent back as base64 MP3 chunks (ElevenLabs & MiniMax)
 */
export class VoicePipelineService extends EventEmitter {
  private sessionId: string;
  private stt: DeepgramSTTService;
  private tts: TTSService;
  private messages: ConversationMessage[] = [];
  private isProcessing = false;
  /** Buffer: accumulates isFinal transcripts until UtteranceEnd fires */
  private pendingTranscript = '';
  private lastTranscriptTime = 0;
  private lastLLMCallTime = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
    this.stt = new DeepgramSTTService(sessionId);

    // Dynamic TTS provider selection based on TTS_PROVIDER env var
    if (env.TTS_PROVIDER === 'minimax') {
      log.info('Using MiniMax TTS provider', undefined, sessionId);
      this.tts = new MiniMaxTTSService(sessionId);
    } else {
      log.info('Using ElevenLabs TTS provider', undefined, sessionId);
      this.tts = new ElevenLabsTTSService(sessionId);
    }
  }

  start() {
    log.info('Voice pipeline starting', undefined, this.sessionId);

    this.stt.on('transcript', (event) => {
      console.log('[PIPELINE] STT event "received"', { isFinal: event.isFinal, text: event.transcript, hasUtteranceEnd: false });
      if (event.isFinal && event.transcript.trim()) {
        // Accumulate isFinal transcripts — Deepgram sends multiple per utterance
        // as it refines the transcription. Don't process yet — wait for UtteranceEnd.
        this.pendingTranscript = event.transcript.trim();
        log.info('STT isFinal (buffered)', { text: this.pendingTranscript }, this.sessionId);
      } else if (event.transcript.trim()) {
        this.emit('transcript', { text: event.transcript, role: 'user', interim: true });
      }
    });

    // UtteranceEnd = Deepgram confirms the user has stopped speaking
    // This is the ONLY point where we process the buffered transcript
    this.stt.on('utterance_end', () => {
      console.log('[PIPELINE] UtteranceEnd "received"', { pendingTranscript: this.pendingTranscript, isProcessing: this.isProcessing });
      if (this.pendingTranscript && !this.isProcessing) {
        log.info('UtteranceEnd — processing buffered transcript', { text: this.pendingTranscript }, this.sessionId);
        const transcript = this.pendingTranscript;
        this.pendingTranscript = '';
        this.emit('transcript', { text: transcript, role: 'user', interim: false });
        this.handleUserSpeech(transcript);
      }
      this.pendingTranscript = '';
    });

    this.stt.on('error', (error) => {
      log.error('STT error', { error: String(error) }, this.sessionId);
      this.emit('error', `STT: ${String(error)}`);
    });

    const ttsFormat = 'mp3';
    this.tts.on('audio_chunk', (buffer: Buffer) => {
      console.log('[PIPELINE] audio_chunk received', buffer.length, ttsFormat);
      console.log('[PIPELINE] emitting audio_chunk to WS');
      this.emit('audio_chunk', buffer, ttsFormat);
    });

    this.tts.on('done', () => {
      console.log('[PIPELINE] TTS done "event"');
      log.info('TTS playback complete', undefined, this.sessionId);
      this.emit('status', 'idle');
      this.resetSilenceTimer();
    });

    this.tts.on('error', (error) => {
      log.error('TTS error', { error: String(error) }, this.sessionId);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('401')) {
        this.emit('error', `TTS API key invalid (${env.TTS_PROVIDER})`);
      } else {
        this.emit('error', `TTS: ${msg}`);
      }
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
    console.log('[PIPELINE] handleUserSpeech "called"', { text: transcript, isProcessing: this.isProcessing });
    // Guard: only one LLM call at a time
    if (this.isProcessing) {
      log.info('Speech ignored — already processing', { text: transcript }, this.sessionId);
      return;
    }

    // Rate limiter: at least 1s between LLM calls
    const elapsed = Date.now() - this.lastLLMCallTime;
    if (elapsed < 1000) {
      const delayMs = 1000 - elapsed;
      log.info('LLM rate limit delay', { delayMs }, this.sessionId);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    this.lastLLMCallTime = Date.now();
    this.lastTranscriptTime = Date.now();

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
      console.log('[PIPELINE] LLM stream "starting"', { messageCount: this.messages.length });
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
            console.log('[PIPELINE] LLM stream "complete"', { fullResponse: fullResponse.substring(0, 100) });
            this.messages.push({
              role: 'assistant',
              content: fullResponse,
              timestamp: Date.now(),
            });

            // FIX 2: Rolling window — keep context small and prevent RAM growth
            if (this.messages.length > 20) {
              this.messages = this.messages.slice(-20);
            }

            log.info('Agent said', { text: fullResponse }, this.sessionId);
            this.emit('transcript', { text: fullResponse, role: 'assistant' });
            this.emit('status', 'speaking');
            console.log('[PIPELINE] TTS synthesis "starting"', { textLength: fullResponse.length });
            await this.tts.synthesize(fullResponse);
            console.log('[PIPELINE] TTS synthesis "complete"');
          }
        }
      }
    } catch (error) {
      log.error('Pipeline error', { error: String(error) }, this.sessionId);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('401') || msg.includes('Incorrect API key')) {
        this.emit('error', 'OpenAI API key invalid');
      } else if (msg.includes('429')) {
        this.emit('error', 'Rate limit exceeded — try again later');
      } else {
        this.emit('error', msg);
      }
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
    this.pendingTranscript = '';
    this.stt.close();
    this.removeAllListeners();
  }

  getMessages(): ConversationMessage[] {
    return [...this.messages];
  }
}
