package com.nightfall.messenger.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Runtime switches that let one build serve both the normal setup and a private friends instance. */
@Component
public class AuthSettings {
  private final boolean emailVerificationRequired;
  private final String inviteCode;
  private final boolean passwordResetAvailable;
  private final boolean consoleMail;
  private final boolean smtpMail;

  public AuthSettings(
    @Value("${app.auth.email-verification:required}") String emailVerification,
    @Value("${app.auth.invite-code:}") String inviteCode,
    @Value("${app.mail.mode:disabled}") String mailMode
  ) {
    this.emailVerificationRequired = !"off".equalsIgnoreCase(emailVerification == null ? "" : emailVerification.trim());
    this.inviteCode = inviteCode == null ? "" : inviteCode.trim();
    this.passwordResetAvailable = "smtp".equalsIgnoreCase(mailMode) || "console".equalsIgnoreCase(mailMode);
    this.consoleMail = "console".equalsIgnoreCase(mailMode);
    this.smtpMail = "smtp".equalsIgnoreCase(mailMode);
  }

  public boolean emailVerificationRequired() {
    return emailVerificationRequired;
  }

  public boolean inviteRequired() {
    return !inviteCode.isEmpty();
  }

  public boolean passwordResetAvailable() {
    return passwordResetAvailable;
  }

  public boolean consoleMail() {
    return consoleMail;
  }

  public boolean invitationsAvailable() {
    return inviteRequired() && smtpMail;
  }

  public String inviteCode() {
    return inviteCode;
  }

  /** Constant-time comparison so a public link cannot be probed character by character. */
  public boolean inviteMatches(String provided) {
    if (!inviteRequired()) return true;
    if (provided == null) return false;
    return MessageDigest.isEqual(digest(inviteCode), digest(provided.trim()));
  }

  private static byte[] digest(String value) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
