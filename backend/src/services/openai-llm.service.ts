import OpenAI from 'openai';
import { env } from '../config/env.js';
import { createLogger, DEFAULT_SYSTEM_PROMPT, DEFAULT_LLM_MODEL, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from '@cock/shared';
import type { ConversationMessage, LLMChunkEvent } from '@cock/shared';

const log = createLogger('openai-llm');

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL });

/**
 * Stream an LLM response for a phone conversation
 */
export async function* streamLLMResponse(
  messages: ConversationMessage[],
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  model: string = env.OPENAI_MODEL || DEFAULT_LLM_MODEL,
): AsyncGenerator<LLMChunkEvent> {
  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  log.info('LLM stream starting', { model, messageCount: messages.length });

  const stream = await openai.chat.completions.create({
    model,
    messages: openaiMessages,
    max_tokens: DEFAULT_MAX_TOKENS,
    temperature: DEFAULT_TEMPERATURE,
    stream: true,
  });

  let fullContent = '';

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    const finishReason = chunk.choices[0]?.finish_reason;

    if (delta?.content) {
      fullContent += delta.content;
      yield {
        content: delta.content,
        isComplete: false,
      };
    }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        yield {
          content: '',
          isComplete: false,
          functionCall: {
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || '',
          },
        };
      }
    }

    if (finishReason === 'stop' || finishReason === 'tool_calls') {
      yield {
        content: '',
        isComplete: true,
        usage: chunk.usage ? {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        } : undefined,
      };
    }
  }

  log.info('LLM stream complete', { responseLength: fullContent.length });
}

/**
 * Non-streaming LLM call (for summarization, etc.)
 */
export async function callLLM(
  prompt: string,
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  model: string = env.OPENAI_MODEL || DEFAULT_LLM_MODEL,
): Promise<string> {
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: 500,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || '';
}
