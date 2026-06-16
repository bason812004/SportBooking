type LogMeta = Record<string, unknown>;

export const logger = {
  info(message: string, meta?: LogMeta) {
    console.info(JSON.stringify({ level: "info", message, meta, timestamp: new Date().toISOString() }));
  },
  warn(message: string, meta?: LogMeta) {
    console.warn(JSON.stringify({ level: "warn", message, meta, timestamp: new Date().toISOString() }));
  },
  error(message: string, meta?: LogMeta) {
    console.error(JSON.stringify({ level: "error", message, meta, timestamp: new Date().toISOString() }));
  }
};
