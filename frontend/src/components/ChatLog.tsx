import type { ChatMessage } from '../hooks/useVoiceWebSocket';

interface ChatLogProps {
  messages: ChatMessage[];
}

export function ChatLog({ messages }: ChatLogProps) {
  if (messages.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-8">
        Noch keine Nachrichten. Halte den Button gedrückt und sprich.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-h-64 overflow-y-auto px-1">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-gray-700 text-gray-100 rounded-bl-md'
            }`}
          >
            <span className="text-[10px] opacity-60 block mb-0.5">
              {msg.role === 'user' ? 'Du' : 'Assistent'}
            </span>
            {msg.text}
          </div>
        </div>
      ))}
    </div>
  );
}
