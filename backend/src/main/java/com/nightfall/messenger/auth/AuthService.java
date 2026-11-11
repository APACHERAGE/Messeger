package com.nightfall.messenger.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
  private static final SecureRandom RANDOM = new SecureRandom();

  private final AuthUserRepository users;
  private final EmailVerificationRepository verifications;
  private final PasswordResetRepository passwordResets;
  private final PasswordEncoder passwordEncoder;
  private final RegistrationMailService mail;
  private final AuthSettings settings;

  public AuthService(
    AuthUserRepository users,
    EmailVerificationRepository verifications,
    PasswordResetRepository passwordResets,
    PasswordEncoder passwordEncoder,
    RegistrationMailService mail,
    AuthSettings settings
  ) {
    this.users = users;
    this.verifications = verifications;
    this.passwordResets = passwordResets;
    this.passwordEncoder = passwordEncoder;
    this.mail = mail;
    this.settings = settings;
  }

  @Transactional
  public void register(AuthController.RegisterRequest input) {
    String email = input.email().trim().toLowerCase(Locale.ROOT);
    String username = input.username().trim().toLowerCase(Locale.ROOT);
    AuthUserEntity user = users.findByEmailIgnoreCase(email).orElse(null);

    if (user != null && user.emailVerified) {
      if (!settings.emailVerificationRequired()) {
        throw new ResponseStatusException(HttpStatus.CONFLICT,
          "This email is already registered. Sign in instead.");
      }
      return;
    }
    if (user != null && !settings.emailVerificationRequired()) {
      // A pending account may have been created while email verification was
      // enabled. Disabling mail must not let a new request claim that identity.
      throw new ResponseStatusException(HttpStatus.CONFLICT,
        "This email has an unfinished registration. Contact the site owner to complete it.");
    }
    if (user == null && users.existsByUsernameIgnoreCase(username)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "This username is already taken.");
    }
    if (user != null) {
      String existingUserId = user.id;
      users.findByUsernameIgnoreCase(username)
        .filter(other -> !other.id.equals(existingUserId))
        .ifPresent(other -> {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "This username is already taken.");
        });
    }
    if (!input.password().equals(input.confirmPassword())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Passwords do not match.");
    }
    if (input.password().getBytes(StandardCharsets.UTF_8).length > 72) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is too long.");
    }

    AuthUserEntity candidate = new AuthUserEntity();
    candidate.firstName = input.firstName().trim();
    candidate.lastName = input.lastName() == null ? "" : input.lastName().trim();
    candidate.username = username;
    candidate.email = email;
    candidate.passwordHash = passwordEncoder.encode(input.password());

    if (user == null) {
      candidate.id = UUID.randomUUID().toString();
      candidate.emailVerified = !settings.emailVerificationRequired();
      user = users.save(candidate);
    }
    if (!settings.emailVerificationRequired()) {
      verifications.deleteAll(verifications.findByUserId(user.id));
      return;
    }
    // Preserve previously emailed links. Their own snapshots keep the name,
    // username and password chosen for that particular registration attempt.
    String token = newToken();
    verifications.save(new EmailVerificationEntity(hashToken(token), user.id, Instant.now().plus(24, ChronoUnit.HOURS), candidate));
    mail.sendVerification(candidate, token);
  }

  @Transactional
  public void resendVerification(String email) {
    String normalized = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    AuthUserEntity user = users.findByEmailIgnoreCase(normalized)
      .filter(account -> !account.emailVerified)
      .orElse(null);
    if (user == null) return;
    EmailVerificationEntity latest = verifications.findByUserId(user.id).stream()
      .filter(item -> item.expiresAt.isAfter(Instant.now()))
      .max(java.util.Comparator.comparing(item -> item.expiresAt))
      .orElse(null);
    AuthUserEntity candidate = new AuthUserEntity();
    candidate.firstName = latest != null && latest.firstName != null ? latest.firstName : user.firstName;
    candidate.lastName = latest != null && latest.lastName != null ? latest.lastName : user.lastName;
    candidate.username = latest != null && latest.username != null ? latest.username : user.username;
    candidate.email = user.email;
    candidate.passwordHash = latest != null && latest.passwordHash != null ? latest.passwordHash : user.passwordHash;
    String token = newToken();
    verifications.save(new EmailVerificationEntity(hashToken(token), user.id, Instant.now().plus(24, ChronoUnit.HOURS), candidate));
    mail.sendVerification(candidate, token);
  }

  @Transactional
  public void verify(String token, String password) {
    if (token == null || token.length() > 128) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification link is invalid or expired.");
    }
    if (password == null || password.isBlank() || password.length() > 72
      || password.getBytes(StandardCharsets.UTF_8).length > 72) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the password you chose when creating this account.");
    }
    String tokenHash = hashToken(token);
    EmailVerificationEntity verification = verifications.findByTokenHash(tokenHash)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification link is invalid or expired."));
    if (!verification.expiresAt.isAfter(Instant.now())) {
      verifications.delete(verification);
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification link has expired. Request a new email.");
    }
    AuthUserEntity user = users.findById(verification.userId)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Account not found."));
    if (user.emailVerified) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification link is invalid or expired.");
    }
    String candidateHash = verification.passwordHash != null ? verification.passwordHash : user.passwordHash;
    if (!passwordEncoder.matches(password, candidateHash)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password does not match this registration. Use the password you chose when creating the account.");
    }
    if (verification.username != null) {
      users.findByUsernameIgnoreCase(verification.username)
        .filter(other -> !other.id.equals(user.id))
        .ifPresent(other -> {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "This username was taken while you were verifying. Choose another username and register again.");
        });
      user.firstName = verification.firstName;
      user.lastName = verification.lastName;
      user.username = verification.username;
      user.passwordHash = verification.passwordHash;
    }
    user.emailVerified = true;
    users.save(user);
    verifications.deleteAll(verifications.findByUserId(user.id));
  }

  @Transactional
  public void requestPasswordReset(String identifier) {
    // Without a mail provider there is no way to deliver the link. Return the
    // same generic outcome so account existence cannot be inferred from a 503.
    if (!settings.passwordResetAvailable()) return;
    String normalized = identifier.trim().toLowerCase(Locale.ROOT);
    AuthUserEntity user = users.findByEmailIgnoreCase(normalized)
      .or(() -> users.findByUsernameIgnoreCase(normalized))
      .filter(account -> account.emailVerified)
      .orElse(null);
    if (user == null) return;
    passwordResets.deleteAll(passwordResets.findByUserId(user.id));
    String token = newToken();
    passwordResets.save(new PasswordResetEntity(hashToken(token), user.id, Instant.now().plus(30, ChronoUnit.MINUTES)));
    mail.sendPasswordReset(user, token);
  }

  @Transactional
  public void resetPassword(String token, String password, String confirmPassword) {
    if (token == null || token.length() > 128) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password reset link is invalid or expired.");
    }
    if (password == null || password.length() < 10 || password.length() > 72
      || password.getBytes(StandardCharsets.UTF_8).length > 72) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain 10–72 characters.");
    }
    if (!password.equals(confirmPassword)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Passwords do not match.");
    }
    String tokenHash = hashToken(token);
    PasswordResetEntity reset = passwordResets.findByTokenHash(tokenHash)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password reset link is invalid or expired."));
    if (!reset.expiresAt.isAfter(Instant.now())) {
      passwordResets.delete(reset);
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password reset link has expired. Request a new one.");
    }
    AuthUserEntity user = users.findById(reset.userId)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Account not found."));
    user.passwordHash = passwordEncoder.encode(password);
    users.save(user);
    passwordResets.deleteAll(passwordResets.findByUserId(user.id));
  }

  private static String newToken() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private static String hashToken(String token) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
