import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Twilio
  TWILIO_ACCOUNT_SID: z.string().default('AC_PLACEHOLDER'),
  TWILIO_AUTH_TOKEN: z.string().default('placeholder'),
  TWILIO_PHONE_NUMBER: z.string().default('+43000000000'),

  // Deepgram (STT)
  DEEPGRAM_API_KEY: z.string().default('placeholder'),

  // ElevenLabs (TTS)
  ELEVENLABS_API_KEY: z.string().default('placeholder'),
  ELEVENLABS_VOICE_ID: z.string().default('placeholder'),

  // OpenAI (LLM)
  OPENAI_API_KEY: z.string().default('sk-placeholder'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
});

export const env = envSchema.parse(process.env);
