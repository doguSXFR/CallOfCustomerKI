/**
 * Convert Float32Array (Web Audio API) to PCM16 Int16Array at target sample rate.
 * If source sample rate differs from target, performs simple linear interpolation resampling.
 */
export function float32ToPcm16(
  float32: Float32Array,
  sourceRate: number,
  targetRate: number = 16000,
): Int16Array {
  let samples = float32;

  if (sourceRate !== targetRate) {
    const ratio = sourceRate / targetRate;
    const newLength = Math.floor(float32.length / ratio);
    const resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIdx = i * ratio;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, float32.length - 1);
      const frac = srcIdx - lo;
      resampled[i] = float32[lo] * (1 - frac) + float32[hi] * frac;
    }
    samples = resampled;
  }

  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
}

/**
 * Convert Int16Array to base64 string for JSON transport.
 */
export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64-encoded MP3/PCM to a Blob URL for playback.
 */
export function base64ToBlobUrl(base64: string, mimeType: string = 'audio/mpeg'): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Convert base64-encoded PCM16 16kHz mono to an AudioBuffer for Web Audio API playback.
 */
export function pcm16Base64ToAudioBuffer(
  base64: string,
  audioContext: AudioContext,
  sampleRate: number = 16000,
): AudioBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // Ensure even byte length for Int16Array (PCM16 = 2 bytes per sample)
  const evenLength = bytes.length - (bytes.length % 2);
  const int16 = new Int16Array(bytes.buffer, 0, evenLength / 2);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }

  const audioBuffer = audioContext.createBuffer(1, float32.length, sampleRate);
  audioBuffer.getChannelData(0).set(float32);
  return audioBuffer;
}
