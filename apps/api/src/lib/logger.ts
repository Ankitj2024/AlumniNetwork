/* Minimal structured logger. Silent under tests unless LOG_LEVEL is set. */
const silent = (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') && !process.env.LOG_LEVEL;

function line(level: string, msg: string, meta?: unknown) {
  if (silent) return;
  const out = { t: new Date().toISOString(), level, msg, ...(meta && typeof meta === 'object' ? meta : meta !== undefined ? { meta } : {}) };
  (level === 'error' ? console.error : console.log)(JSON.stringify(out));
}

export const logger = {
  info: (msg: string, meta?: unknown) => line('info', msg, meta),
  warn: (msg: string, meta?: unknown) => line('warn', msg, meta),
  error: (msg: string, meta?: unknown) => line('error', msg, meta),
};
