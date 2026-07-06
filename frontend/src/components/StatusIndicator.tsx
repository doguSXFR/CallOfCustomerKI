export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

interface StatusIndicatorProps {
  status: VoiceStatus;
}

const STATUS_CONFIG: Record<VoiceStatus, { label: string; color: string; pulse: boolean }> = {
  idle: { label: 'Bereit', color: 'bg-gray-500', pulse: false },
  listening: { label: 'Hört zu...', color: 'bg-green-500', pulse: true },
  processing: { label: 'Verarbeitet...', color: 'bg-yellow-500', pulse: true },
  speaking: { label: 'Spricht...', color: 'bg-blue-500', pulse: true },
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2 justify-center">
      <div
        className={`w-2.5 h-2.5 rounded-full ${config.color} ${
          config.pulse ? 'animate-pulse' : ''
        }`}
      />
      <span className="text-xs text-gray-400 uppercase tracking-wider">
        {config.label}
      </span>
    </div>
  );
}
