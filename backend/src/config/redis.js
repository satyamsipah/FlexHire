import { Redis } from 'ioredis';

// Returns { pubClient, subClient } for the Socket.io Redis adapter,
// or null if REDIS_URL is not configured (adapter skipped in dev without Redis).
export function createRedisClients() {
  if (!process.env.REDIS_URL) {
    console.warn('[redis] REDIS_URL not set — Socket.io Redis adapter disabled');
    return null;
  }

  const pubClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const subClient = pubClient.duplicate();

  pubClient.on('error', err => console.error('[redis] pub:', err.message));
  subClient.on('error', err => console.error('[redis] sub:', err.message));

  return { pubClient, subClient };
}
