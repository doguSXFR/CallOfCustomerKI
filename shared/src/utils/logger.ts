/**
 * Structured logger for the call pipeline
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  callSid?: string;
  component: string;
  data?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatLog(entry: LogEntry): string {
  const callTag = entry.callSid ? `[${entry.callSid.slice(-8)}]` : '';
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  return `${entry.timestamp} [${entry.level.toUpperCase()}] [${entry.component}]${callTag} ${entry.message}${dataStr}`;
}

function createLogger(component: string) {
  const log = (level: LogLevel, message: string, data?: Record<string, unknown>, callSid?: string) => {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      callSid,
      component,
      data,
    };

    const formatted = formatLog(entry);

    switch (level) {
      case 'error': console.error(formatted); break;
      case 'warn': console.warn(formatted); break;
      default: console.log(formatted);
    }
  };

  return {
    debug: (msg: string, data?: Record<string, unknown>, callSid?: string) =>
      log('debug', msg, data, callSid),
    info: (msg: string, data?: Record<string, unknown>, callSid?: string) =>
      log('info', msg, data, callSid),
    warn: (msg: string, data?: Record<string, unknown>, callSid?: string) =>
      log('warn', msg, data, callSid),
    error: (msg: string, data?: Record<string, unknown>, callSid?: string) =>
      log('error', msg, data, callSid),
  };
}

export const logger = createLogger('app');
export { createLogger };
