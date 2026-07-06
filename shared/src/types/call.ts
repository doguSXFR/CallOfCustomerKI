/**
 * Call-related types shared between backend and future frontend
 */

export interface CallSession {
  /** Twilio Call SID */
  callSid: string;
  /** Caller phone number (E.164) */
  callerNumber: string;
  /** Called phone number (E.164) */
  calledNumber: string;
  /** Call start timestamp (Unix ms) */
  startedAt: number;
  /** Current call status */
  status: CallStatus;
  /** Conversation history */
  messages: ConversationMessage[];
}

export type CallStatus =
  | 'ringing'
  | 'in-progress'
  | 'on-hold'
  | 'completed'
  | 'failed'
  | 'no-answer'
  | 'busy';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Timestamp (Unix ms) */
  timestamp: number;
  /** Audio duration in ms (for voice messages) */
  audioDurationMs?: number;
}

export interface CallMetadata {
  callSid: string;
  duration: number;
  startTime: string;
  endTime: string;
  callerNumber: string;
  calledNumber: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  summary?: string;
  /** Whether the call was transferred to a human */
  transferredToHuman: boolean;
}
