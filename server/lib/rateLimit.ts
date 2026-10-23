interface RateBucket {
  count: number;
  resetAt: number;
}

const textBuckets = new Map<string, RateBucket>();
const voiceBuckets = new Map<string, RateBucket>();

const ONE_HOUR_MS = 60 * 60 * 1000;

function checkBucket(map: Map<string, RateBucket>, sessionId: string, maxPerHour: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = map.get(sessionId);

  if (!bucket || now > bucket.resetAt) {
    map.set(sessionId, { count: 1, resetAt: now + ONE_HOUR_MS });
    return { allowed: true, remaining: maxPerHour - 1 };
  }

  if (bucket.count >= maxPerHour) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: maxPerHour - bucket.count };
}

export function checkTextRateLimit(sessionId: string) {
  return checkBucket(textBuckets, sessionId, 30);
}

export function checkVoiceRateLimit(sessionId: string) {
  return checkBucket(voiceBuckets, sessionId, 10);
}