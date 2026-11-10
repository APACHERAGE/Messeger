package com.nightfall.messenger.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "password_resets", indexes = {
  @Index(name = "idx_password_resets_user", columnList = "userId")
})
public class PasswordResetEntity {
  @Id
  @Column(nullable = false, length = 64)
  public String tokenHash;

  @Column(nullable = false, length = 36)
  public String userId;

  @Column(nullable = false)
  public Instant expiresAt;

  protected PasswordResetEntity() {}

  public PasswordResetEntity(String tokenHash, String userId, Instant expiresAt) {
    this.tokenHash = tokenHash;
    this.userId = userId;
    this.expiresAt = expiresAt;
  }
}
