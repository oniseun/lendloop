type LogLevel = 'info' | 'warn' | 'error';
type LogContext = Record<string, string | number | boolean | null | undefined>;

// Structured logs only. Pass ids and outcomes, never emails, names,
// signatures or secrets.
export const createLogger = (scope: string) => {
  const write = (
    level: LogLevel,
    message: string,
    context: LogContext = {},
  ) => {
    const line = JSON.stringify({ level, scope, message, ...context });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.info(line);
  };

  return {
    info: (message: string, context?: LogContext) =>
      write('info', message, context),
    warn: (message: string, context?: LogContext) =>
      write('warn', message, context),
    error: (message: string, context?: LogContext) =>
      write('error', message, context),
  };
};
