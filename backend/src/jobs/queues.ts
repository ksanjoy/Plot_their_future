export const QUEUES = {
  dispatch: 'dispatch',
  receipts: 'receipts',
  notifications: 'notifications',
  reminders: 'reminders',
  maintenance: 'maintenance',
} as const;

/** Evaluated when modules are declared, so `src/load-env.ts` must run first. */
export const workersEnabled = () => !['0', 'false', 'no', 'off'].includes((process.env.RUN_WORKERS ?? '1').toLowerCase());

export function redisConnectionFromUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname && u.pathname !== '/' ? Number(u.pathname.slice(1)) : 0,
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

export const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 3_000 },
  removeOnComplete: { age: 7 * 86_400, count: 5_000 },
  removeOnFail: { age: 30 * 86_400 },
};
