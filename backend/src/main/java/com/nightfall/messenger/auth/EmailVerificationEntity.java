package com.nightfall.messenger.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "email_verifications", indexes = {
  @Index(name = "idx_email_verifications_user", columnList = "userId")
})
public class EmailVerificationEntity {
  @Id
  @Column(nullable = false, length = 64)
  public String tokenHash;

  @Column(nullable = false, length = 36)
  public String userId;

  @Column(nullable = false)
  public Instant expiresAt;

  // Each link belongs to one registration attempt. Nullable for links that
  // were issued before this schema was introduced.
  @Column(length = 48)
  public String firstName;

  @Column(length = 48)
  public String lastName;

  @Column(length = 24)
  public String username;

  @Column(length = 100)
  public String passwordHash;

  protected EmailVerificationEntity() {}

  public EmailVerificationEntity(String tokenHash, String userId, Instant expiresAt) {
    this.tokenHash = tokenHash;
    this.userId = userId;
    this.expiresAt = expiresAt;
  }

  public EmailVerificationEntity(String tokenHash, String userId, Instant expiresAt, AuthUserEntity candidate) {
    this(tokenHash, userId, expiresAt);
    this.firstName = candidate.firstName;
    this.lastName = candidate.lastName;
    this.username = candidate.username;
    this.passwordHash = candidate.passwordHash;
  }
}
