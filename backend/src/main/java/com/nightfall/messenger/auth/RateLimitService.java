package com.nightfall.messenger.auth;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Small in-process sliding-window limiter for authentication endpoints.
 *
 * <p>It is intentionally dependency-free and is good enough for a single
 * instance. A multi-instance deployment should replace it with a shared
 * store (Redis or a gateway-level limiter).</p>
 */
@Service
public class RateLimitService {
  private static final int MAX_TRACKED_KEYS = 20_000;

  private record Window(long startedAt, long expiresAt, int count) {}

  private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

  public synchronized void check(String key, int limit, Duration duration) {
    if (limit <= 0 || duration.isNegative() || duration.isZero()) return;
    long now = System.currentTimeMillis();
    long windowMillis = Math.max(1, duration.toMillis());
    if (!windows.containsKey(key) && windows.size() >= MAX_TRACKED_KEYS) {
      windows.entrySet().removeIf(entry -> now >= entry.getValue().expiresAt());
      if (windows.size() >= MAX_TRACKED_KEYS) {
        throw new RateLimitException(60);
      }
    }
    Window current = windows.compute(key, (ignored, previous) -> {
      if (previous == null || now >= previous.expiresAt()) {
        return new Window(now, now + windowMillis, 1);
      }
      return new Window(previous.startedAt(), previous.expiresAt(), previous.count() + 1);
    });
    if (current.count() > limit) {
      long retryAfter = Math.max(1, (current.expiresAt() - now + 999) / 1000);
      throw new RateLimitException(retryAfter);
    }
  }

  public void reset(String key) {
    windows.remove(key);
  }

  /** Test hook: clears every window so independent scenarios do not share counters. */
  public void clear() {
    windows.clear();
  }
}
