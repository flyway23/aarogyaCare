import { env } from '../config/env.js';

/** @param {'producer'|'worker'} [kind] @returns {Record<string, unknown>} */
export const bullConnection = (kind = 'producer') => {
  const url = new URL(env.REDIS_URL);
  const database = url.pathname.slice(1);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(database ? { db: Number(database) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: kind === 'worker' ? null : 1,
  };
};
