/**
 * Shared configuration constants
 */

/** Audio format used by Twilio Media Streams */
export const TWILIO_AUDIO_SAMPLE_RATE = 8000;
export const TWILIO_AUDIO_ENCODING = 'mulaw';
export const TWILIO_AUDIO_CHANNELS = 1;

/** Deepgram streaming config */
export const DEEPGRAM_SAMPLE_RATE = 16000;
export const DEEPGRAM_ENCODING = 'linear16';
export const DEEPGRAM_CHANNELS = 1;

/** TTS output config */
export const TTS_SAMPLE_RATE = 24000;
export const TTS_OUTPUT_FORMAT = 'mp3_44100_128' as const;

/** WebSocket paths */
export const WS_PATH_MEDIA = '/ws/twilio/media';
export const WS_PATH_VOICE_STREAM = '/ws/voice/stream';
export const WS_PATH_STATUS = '/ws/status';

/** Call timeouts */
export const MAX_CALL_DURATION_MS = 30 * 60 * 1000; // 30 min
export const SILENCE_TIMEOUT_MS = 30_000; // 30s silence → end call
export const PROCESSING_TIMEOUT_MS = 15_000; // 15s max for LLM response

/** LLM defaults */
export const DEFAULT_LLM_MODEL = 'gpt-4o-mini';
export const DEFAULT_MAX_TOKENS = 300;
export const DEFAULT_TEMPERATURE = 0.7;

/** API rate limits */
export const MAX_CONCURRENT_CALLS = 10;
export const MAX_TRANSCRIPT_LENGTH = 10_000;
