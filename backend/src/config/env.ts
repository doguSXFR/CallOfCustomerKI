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

  // MiniMax (TTS)
  MINIMAX_API_KEY: z.string().default('placeholder'),
  MINIMAX_GROUP_ID: z.string().default('placeholder'),
  MINIMAX_VOICE_ID: z.string().default('German_SweetLady'),

  // TTS provider selection: 'elevenlabs' | 'minimax'
  TTS_PROVIDER: z.enum(['elevenlabs', 'minimax']).default('elevenlabs'),

  // OpenAI (LLM)
  OPENAI_API_KEY: z.string().default('placeholder'),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
});

export const env = envSchema.parse(process.env);
