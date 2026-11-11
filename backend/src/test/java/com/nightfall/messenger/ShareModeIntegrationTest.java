package com.nightfall.messenger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nightfall.messenger.auth.AuthUserRepository;
import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.RateLimitService;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.BeanUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
  "app.auth.invite-code=friend-code",
  "app.auth.email-verification=off",
  "app.mail.mode=disabled",
  "spring.datasource.url=jdbc:h2:mem:nightfall-share-test;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ShareModeIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired AuthUserRepository users;
  @Autowired RateLimitService rateLimit;
  @Autowired PasswordEncoder passwordEncoder;

  @BeforeEach
  void resetRateLimits() {
    rateLimit.clear();
  }

  private String registration(String username, String email, String inviteCode) throws Exception {
    return json.writeValueAsString(Map.of(
      "firstName", "Friend",
      "lastName", "Account",
      "username", username,
      "email", email,
      "password", "friends-only-password",
      "confirmPassword", "friends-only-password",
      "inviteCode", inviteCode
    ));
  }

  @Test
  void configReportsOpenRegistrationAndNoEmailVerification() throws Exception {
    mvc.perform(get("/api/auth/config"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.inviteRequired").value(false))
      .andExpect(jsonPath("$.emailVerificationRequired").value(false))
      .andExpect(jsonPath("$.passwordResetAvailable").value(false));
  }

  @Test
  void registrationWorksWithoutAnInviteCode() throws Exception {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    String username = "x" + suffix;
    mvc.perform(post("/api/auth/register").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(registration(username, username + "@example.com", "")))
      .andExpect(status().isAccepted());
    assertThat(users.findByUsernameIgnoreCase(username)).isPresent();
  }

  @Test
  void invitedAccountIsVerifiedImmediatelyAndCanSignIn() throws Exception {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    String username = "f" + suffix;
    String email = username + "@example.com";

    mvc.perform(post("/api/auth/register").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(registration(username, email, "friend-code")))
      .andExpect(status().isAccepted())
      .andExpect(jsonPath("$.verificationRequired").value(false));

    assertThat(users.findByEmailIgnoreCase(email).orElseThrow().emailVerified).isTrue();

    mvc.perform(post("/api/auth/login").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("identifier", username, "password", "friends-only-password"))))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.authenticated").value(true))
      .andExpect(jsonPath("$.user.username").value(username));

    mvc.perform(post("/api/auth/register").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(registration(username, email, "")))
      .andExpect(status().isConflict())
      .andExpect(jsonPath("$.message").value("This email is already registered. Sign in instead."));
  }

  @Test
  void switchingOffEmailVerificationCannotClaimPendingAccount() throws Exception {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    String email = "pending" + suffix + "@example.com";
    AuthUserEntity pending = BeanUtils.instantiateClass(AuthUserEntity.class);
    pending.id = UUID.randomUUID().toString();
    pending.firstName = "Original";
    pending.lastName = "Owner";
    pending.username = "original" + suffix;
    pending.email = email;
    pending.passwordHash = passwordEncoder.encode("original-password");
    pending.emailVerified = false;
    users.save(pending);

    mvc.perform(post("/api/auth/register").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(registration("claim" + suffix, email, "friend-code")))
      .andExpect(status().isConflict());

    AuthUserEntity unchanged = users.findByEmailIgnoreCase(email).orElseThrow();
    assertThat(unchanged.emailVerified).isFalse();
    assertThat(unchanged.username).isEqualTo("original" + suffix);
    assertThat(passwordEncoder.matches("original-password", unchanged.passwordHash)).isTrue();
  }
}
