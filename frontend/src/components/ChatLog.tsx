import type { ChatMessage } from '../hooks/useVoiceWebSocket';

interface ChatLogProps {
  messages: ChatMessage[];
}

export function ChatLog({ messages }: ChatLogProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🎙️</div>
        <p className="text-muted-foreground text-sm">
          Noch keine Nachrichten.
        </p>
        <p className="text-muted-foreground text-xs mt-1">
          Klicke den Button und sprich.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-h-80 overflow-y-auto px-1">
      {messages.map((msg, i) => (
        <div
          key={`${msg.timestamp}-${msg.text}-${i}`}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-secondary text-secondary-foreground rounded-bl-md'
            }`}
          >
            <span className="text-[10px] opacity-60 block mb-1 font-medium uppercase tracking-wider">
              {msg.role === 'user' ? 'Du' : 'Assistent'}
            </span>
            <p className="leading-relaxed">{msg.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
