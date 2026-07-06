import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Twilio
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC'),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().startsWith('+'),

  // Deepgram (STT)
  DEEPGRAM_API_KEY: z.string().min(1),

  // ElevenLabs (TTS)
  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_VOICE_ID: z.string().min(1),

  // OpenAI (LLM)
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
});

export const env = envSchema.parse(process.env);
