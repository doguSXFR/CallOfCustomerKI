/**
 * Audio conversion utilities
 * Twilio sends mulaw 8kHz, Deepgram wants linear16 16kHz
 */

/**
 * Convert base64 mulaw audio from Twilio to linear16 PCM
 */
export function mulawToLinear16(base64Mulaw: string): Buffer {
  const mulawBuffer = Buffer.from(base64Mulaw, 'base64');
  const linear16Buffer = Buffer.alloc(mulawBuffer.length * 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = decodeMulawSample(mulawBuffer[i]);
    linear16Buffer.writeInt16LE(sample, i * 2);
  }

  return linear16Buffer;
}

/**
 * Convert linear16 PCM to base64 mulaw for Twilio
 */
export function linear16ToMulaw(pcmBuffer: Buffer): string {
  const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    mulawBuffer[i] = encodeMulawSample(sample);
  }

  return mulawBuffer.toString('base64');
}

function decodeMulawSample(mulawByte: number): number {
  mulawByte = ~mulawByte & 0xff;
  const sign = (mulawByte & 0x80) ? -1 : 1;
  const exponent = (mulawByte >> 4) & 0x07;
  const mantissa = mulawByte & 0x0f;
  const sample = ((mantissa << 1) + 33) << (exponent + 2);
  return sign * (sample - 132);
}

function encodeMulawSample(sample: number): number {
  const MULAW_MAX = 0x1fff;
  const MULAW_BIAS = 0x84;

  const sign = sample < 0 ? 0x80 : 0;
  if (sign) sample = -sample;
  if (sample > MULAW_MAX) sample = MULAW_MAX;
  sample += MULAW_BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; exponent > 0; exponent--, expMask >>= 1) {
    if (sample & expMask) break;
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const mulawByte = ~(sign | (exponent << 4) | mantissa) & 0xff;
  return mulawByte;
}

/** Resample audio from one sample rate to another (simple linear interpolation) */
export function resample(
  buffer: Buffer,
  fromRate: number,
  toRate: number,
  bytesPerSample: number = 2
): Buffer {
  if (fromRate === toRate) return buffer;

  const ratio = fromRate / toRate;
  const inputSamples = buffer.length / bytesPerSample;
  const outputSamples = Math.floor(inputSamples / ratio);
  const output = Buffer.alloc(outputSamples * bytesPerSample);

  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = i * ratio;
    const srcFloor = Math.floor(srcIndex);
    const srcCeil = Math.min(srcFloor + 1, inputSamples - 1);
    const frac = srcIndex - srcFloor;

    const sampleA = buffer.readInt16LE(srcFloor * bytesPerSample);
    const sampleB = buffer.readInt16LE(srcCeil * bytesPerSample);
    const interpolated = Math.round(sampleA + frac * (sampleB - sampleA));

    output.writeInt16LE(
      Math.max(-32768, Math.min(32767, interpolated)),
      i * bytesPerSample
    );
  }

  return output;
}
