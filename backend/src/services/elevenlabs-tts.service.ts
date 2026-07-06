import { EventEmitter } from 'events';
import { env } from '../config/env.js';
import { createLogger, TTS_SAMPLE_RATE } from '@cock/shared';

const log = createLogger('elevenlabs-tts');

/**
 * Real-time Text-to-Speech via ElevenLabs streaming API
 *
 * Sends audio chunks as they're generated (low time-to-first-byte).
 * Output format: MP3 44100Hz → needs conversion to mulaw 8kHz for Twilio.
 */
export class ElevenLabsTTSService extends EventEmitter {
  private voiceId: string;
  private callSid: string;

  constructor(callSid: string, voiceId: string = env.ELEVENLABS_VOICE_ID) {
    super();
    this.callSid = callSid;
    this.voiceId = voiceId;
  }

  /**
   * Stream TTS audio for the given text.
   * Emits 'audio_chunk' with Buffer data and 'done' when complete.
   */
  async synthesize(text: string): Promise<void> {
    log.info('TTS synthesis starting', { textLength: text.length }, this.callSid);

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
        output_format: 'mp3_44100_128',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('ElevenLabs API error', { status: response.status, error: errorText }, this.callSid);
      this.emit('error', new Error(`ElevenLabs ${response.status}: ${errorText}`));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      this.emit('error', new Error('No response body'));
      return;
    }

    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.length;
      this.emit('audio_chunk', Buffer.from(value));
    }

    log.info('TTS synthesis complete', { totalBytes }, this.callSid);
    this.emit('done');
  }
}

/**
 * Simple non-streaming TTS (returns full audio buffer)
 */
export async function synthesizeText(
  text: string,
  voiceId: string = env.ELEVENLABS_VOICE_ID
): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      output_format: 'mp3_44100_128',
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
