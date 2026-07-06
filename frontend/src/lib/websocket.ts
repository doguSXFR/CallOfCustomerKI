export type VoiceWSMessage =
  | { type: 'audio'; data: string }
  | { type: 'transcript'; text: string; role: 'user' | 'assistant'; interim?: boolean }
  | { type: 'status'; status: string }
  | { type: 'error'; error: string };

export type VoiceWSSendMessage =
  | { type: 'audio'; data: string }
  | { type: 'end_of_speech' };
