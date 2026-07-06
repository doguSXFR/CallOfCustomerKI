/**
 * WebSocket and pipeline event types
 */

/** Events from Twilio Media Streams */
export interface TwilioMediaEvent {
  event: 'connected' | 'start' | 'media' | 'stop';
  sequenceNumber?: string;
  start?: {
    streamSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // base64 encoded audio (mulaw 8kHz)
  };
  stop?: {
    streamSid: string;
    callSid: string;
  };
}

/** Transcription result from Deepgram */
export interface TranscriptionEvent {
  /** Transcribed text */
  transcript: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Whether this is a final (not interim) result */
  isFinal: boolean;
  /** Detected language */
  language?: string;
  /** Words with timing */
  words?: TranscriptionWord[];
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

/** LLM response chunk (streaming) */
export interface LLMChunkEvent {
  /** Chunk content */
  content: string;
  /** Whether this is the final chunk */
  isComplete: boolean;
  /** Function call if applicable */
  functionCall?: {
    name: string;
    arguments: string;
  };
  /** Token usage (only on final chunk) */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** TTS audio chunk */
export interface TTSAudioChunk {
  /** Base64 encoded audio */
  audio: string;
  /** Audio format */
  format: 'mp3' | 'pcm' | 'mulaw';
  /** Sample rate */
  sampleRate: number;
  /** Whether this is the final chunk */
  isFinal: boolean;
}

/** Pipeline status events */
export interface PipelineEvent {
  type: 'stt_start' | 'stt_end' | 'llm_start' | 'llm_end' | 'tts_start' | 'tts_end' | 'error';
  callSid: string;
  timestamp: number;
  data?: Record<string, unknown>;
  error?: string;
}

// ── Browser Voice Stream Events ──

/** Message from browser to backend */
export type VoiceStreamInMessage =
  | { type: 'audio'; data: string } // base64 PCM16 16kHz mono
  | { type: 'end_of_speech' };

/** Message from backend to browser */
export type VoiceStreamOutMessage =
  | { type: 'audio'; data: string } // base64 MP3 chunk
  | { type: 'transcript'; text: string; role: 'user' | 'assistant' }
  | { type: 'status'; status: 'idle' | 'listening' | 'processing' | 'speaking' }
  | { type: 'error'; error: string };
