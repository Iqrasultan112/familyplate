const buckets = new Map();
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 5 * 60 * 1000);
cleanup.unref?.();

export const rateLimit = ({ limit, windowMs, message }) => (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }
  current.count += 1;
  if (current.count > limit) {
    res.set('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
    return res.status(429).json({ error: message });
  }
  next();
};
