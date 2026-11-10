package com.nightfall.messenger.auth;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** A 429 response that also tells the client when it may retry. */
public class RateLimitException extends ResponseStatusException {
  private final long retryAfterSeconds;

  public RateLimitException(long retryAfterSeconds) {
    super(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Try again in " + retryAfterSeconds + " seconds.");
    this.retryAfterSeconds = retryAfterSeconds;
  }

  public long retryAfterSeconds() {
    return retryAfterSeconds;
  }
}
