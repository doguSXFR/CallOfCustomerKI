import { Badge } from './ui/badge';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

interface StatusIndicatorProps {
  status: VoiceStatus;
}

const STATUS_CONFIG: Record<VoiceStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'info' }> = {
  idle: { label: 'Bereit', variant: 'default' },
  listening: { label: 'Hört zu...', variant: 'success' },
  processing: { label: 'Verarbeitet...', variant: 'warning' },
  speaking: { label: 'Spricht...', variant: 'info' },
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant} className="gap-2">
      <span
        className={`w-2 h-2 rounded-full ${
          status === 'idle' ? 'bg-muted-foreground' :
          status === 'listening' ? 'bg-green-400' :
          status === 'processing' ? 'bg-yellow-400' :
          'bg-blue-400'
        } ${status !== 'idle' ? 'animate-pulse' : ''}`}
      />
      {config.label}
    </Badge>
  );
}
