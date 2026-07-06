/**
 * AI Agent configuration and state types
 */

export interface AgentConfig {
  /** System prompt for the LLM */
  systemPrompt: string;
  /** LLM model to use */
  model: string;
  /** Max tokens for response */
  maxTokens: number;
  /** Temperature for generation */
  temperature: number;
  /** Whether to enable function calling */
  enableFunctions: boolean;
  /** Available functions/tools for the agent */
  functions?: AgentFunction[];
  /** Language for TTS output */
  ttsLanguage: string;
  /** Voice ID for TTS */
  ttsVoiceId: string;
  /** STT language code */
  sttLanguage: string;
}

export interface AgentFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: string;
}

export interface AgentState {
  /** Current conversation turn */
  turnCount: number;
  /** Whether agent is currently processing */
  isProcessing: boolean;
  /** Current intent detection */
  detectedIntent?: string;
  /** Extracted entities from conversation */
  entities: Record<string, unknown>;
}

export type AgentPersonality = 'professional' | 'friendly' | 'concise' | 'empathetic';
