export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

// In-memory store for rate limiting (since this is a simple demo)
// Key format: "userId:actionName"
const store = new Map<string, { count: number; expiresAt: number }>();

/**
 * Basic in-memory rate limiter per admin session.
 * For production, this should use Redis.
 */
export function rateLimit(key: string, options: RateLimitOptions): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.expiresAt < now) {
    // Reset or initialize
    store.set(key, { count: 1, expiresAt: now + options.windowMs });
    return true; // Allowed
  }

  if (entry.count >= options.limit) {
    return false; // Rate limited
  }

  entry.count += 1;
  store.set(key, entry);
  return true; // Allowed
}
