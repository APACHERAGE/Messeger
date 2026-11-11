package com.nightfall.messenger.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AuthRequestRedactionTest {
  @Test
  void debugLoggingCannotPrintPasswordsTokensOrInviteCodes() {
    String password = "private-password-123";
    String token = "private-token-123";
    String invite = "private-invite-123";

    assertThat(new AuthController.RegisterRequest("Alice", "Demo", "alice", "alice@example.test", password, password, invite).toString())
      .doesNotContain(password, invite);
    assertThat(new AuthController.LoginRequest("alice", password).toString())
      .doesNotContain(password);
    assertThat(new AuthController.VerifyRequest(token, password).toString())
      .doesNotContain(token, password);
    assertThat(new AuthController.PasswordResetConfirm(token, password, password).toString())
      .doesNotContain(token, password);
  }
}
