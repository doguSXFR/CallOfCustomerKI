import { EventEmitter } from 'events';
import { env } from '../config/env.js';
import { createLogger, TTS_SAMPLE_RATE } from '@cock/shared';

const log = createLogger('minimax-tts');

/**
 * Real-time Text-to-Speech via MiniMax HTTP streaming T2A API
 *
 * Uses SSE streaming — each chunk contains hex-encoded MP3 audio.
 * Hex is decoded to binary Buffer, then sent to browser as base64 for playback.
 */
export class MiniMaxTTSService extends EventEmitter {
  private voiceId: string;
  private callSid: string;

  constructor(callSid: string, voiceId: string = env.MINIMAX_VOICE_ID) {
    super();
    this.callSid = callSid;
    this.voiceId = voiceId;
  }

  /**
   * Stream TTS audio for the given text.
   * Emits 'audio_chunk' with Buffer data and 'done' when complete.
   *
   * MiniMax SSE format: lines of "data: <json>" where json has:
   *   { data: { audio: "<base64 MP3>" } }
   * End: "data: [DONE]"
   */
  async synthesize(text: string): Promise<void> {
    log.info('TTS synthesis starting', { textLength: text.length }, this.callSid);

    const url = `https://api.minimaxi.chat/v1/t2a_v2?GroupId=${env.MINIMAX_GROUP_ID}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stream: true,
        text,
        model: 'speech-02-turbo',
        voice_setting: {
          voice_id: this.voiceId,
          speed: 1,
          vol: 1,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
          channel: 1,
        },
        language_boost: 'auto',
      }),
    });
    console.log('[MINIMAX] response status', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      log.error('MiniMax API error', { status: response.status, error: errorText }, this.callSid);
      this.emit('error', new Error(`MiniMax ${response.status}: ${errorText}`));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      this.emit('error', new Error('No response body'));
      return;
    }

    const decoder = new TextDecoder();
    let totalBytes = 0;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6); // strip "data: "

        if (data === '[DONE]') {
          log.info('TTS synthesis complete', { totalBytes }, this.callSid);
          this.emit('done');
          return;
        }

        try {
          const json = JSON.parse(data);
          // MiniMax SSE: { data: { audio: "<hex-encoded-audio>" } }
          // Hex string → binary Buffer (MP3 data)
          const audioHex = json.data?.audio ?? json.audio;
          console.log('[MINIMAX] SSE chunk', audioHex?.length || 0, 'hex chars');
          if (audioHex) {
            const audioBuffer = Buffer.from(audioHex, 'hex');
            totalBytes += audioBuffer.length;
            this.emit('audio_chunk', audioBuffer);
          }
        } catch {
          // Non-JSON line (e.g., [DONE] without data: prefix, or noise) — skip
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      const data = buffer.trim().slice(6);
      if (data !== '[DONE]') {
        try {
          const json = JSON.parse(data);
          const audioHex = json.data?.audio ?? json.audio;
          if (audioHex) {
            const audioBuffer = Buffer.from(audioHex, 'hex');
            totalBytes += audioBuffer.length;
            this.emit('audio_chunk', audioBuffer);
          }
        } catch {
          // skip
        }
      }
    }

    log.info('TTS synthesis complete', { totalBytes }, this.callSid);
    console.log('[MINIMAX] total bytes emitted', totalBytes);
    this.emit('done');
  }
}
