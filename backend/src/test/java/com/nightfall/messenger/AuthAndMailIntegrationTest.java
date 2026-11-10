package com.nightfall.messenger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import com.nightfall.messenger.auth.RateLimitService;
import com.nightfall.messenger.auth.RegistrationMailService;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthAndMailIntegrationTest {
  private static final String PASSWORD = "nightfall-test-password";
  private static final String PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired AuthUserRepository users;
  @Autowired RateLimitService rateLimit;
  @MockitoBean RegistrationMailService mail;

  @BeforeEach
  void resetRateLimits() {
    rateLimit.clear();
  }

  private record SessionUser(MockHttpSession session, AuthUserEntity user) {}

  private String registerRaw(String email, String username, String password) throws Exception {
    clearInvocations(mail);
    mvc.perform(post("/api/auth/register").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of(
          "firstName", "Test",
          "lastName", "User",
          "username", username,
          "email", email,
          "password", password,
          "confirmPassword", password
        ))))
      .andExpect(status().isAccepted());
    ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
    verify(mail).sendVerification(any(AuthUserEntity.class), token.capture());
    return token.getValue();
  }

  private void verifyToken(String token, String password) throws Exception {
    mvc.perform(post("/api/auth/verify").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("token", token, "password", password))))
      .andExpect(status().isOk());
  }

  private SessionUser login(String identifier, String password) throws Exception {
    MvcResult result = mvc.perform(post("/api/auth/login").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("identifier", identifier, "password", password))))
      .andExpect(status().isOk())
      .andReturn();
    MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
    AuthUserEntity user = users.findByEmailIgnoreCase(identifier)
      .or(() -> users.findByUsernameIgnoreCase(identifier))
      .orElseThrow();
    return new SessionUser(session, user);
  }

  private SessionUser registerAndLogin(String password) throws Exception {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    String username = "u" + suffix;
    String email = username + "@example.com";
    String token = registerRaw(email, username, password);
    verifyToken(token, password);
    return login(email, password);
  }

  @Test
  void verificationRequiresThePasswordChosenAtRegistration() throws Exception {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    String username = "v" + suffix;
    String email = username + "@example.com";
    String token = registerRaw(email, username, PASSWORD);

    mvc.perform(post("/api/auth/verify").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("token", token, "password", "a-different-password"))))
      .andExpect(status().isBadRequest());

    verifyToken(token, PASSWORD);
    login(email, PASSWORD);
  }

  @Test
  void verificationTokenIsSingleUse() throws Exception {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    String username = "s" + suffix;
    String email = username + "@example.com";
    String token = registerRaw(email, username, PASSWORD);
    verifyToken(token, PASSWORD);

    mvc.perform(post("/api/auth/verify").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("token", token, "password", PASSWORD))))
      .andExpect(status().isBadRequest());
  }

  @Test
  void laterRegistrationCannotChangeAnEarlierEmailLink() throws Exception {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    String email = "claim" + suffix + "@example.test";
    String firstUsername = "first" + suffix;
    String secondUsername = "owner" + suffix;
    String firstPassword = "first-registration-password";
    String secondPassword = "owner-registration-password";
    String firstToken = registerRaw(email, firstUsername, firstPassword);
    String secondToken = registerRaw(email, secondUsername, secondPassword);

    mvc.perform(post("/api/auth/verify").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("token", firstToken, "password", secondPassword))))
      .andExpect(status().isBadRequest());

    verifyToken(secondToken, secondPassword);
    assertThat(users.findByEmailIgnoreCase(email).orElseThrow().username).isEqualTo(secondUsername);
    login(email, secondPassword);
    mvc.perform(post("/api/auth/login").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("identifier", email, "password", firstPassword))))
      .andExpect(status().isUnauthorized());
  }

  @Test
  void resendDoesNotInvalidateEarlierVerificationLink() throws Exception {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    String username = "resend" + suffix;
    String email = username + "@example.test";
    String token = registerRaw(email, username, PASSWORD);

    mvc.perform(post("/api/auth/resend-verification").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("email", email))))
      .andExpect(status().isAccepted());

    verifyToken(token, PASSWORD);
    login(email, PASSWORD);
  }

  @Test
  void loginDoesNotRevealAnUnverifiedAccount() throws Exception {
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    String username = "n" + suffix;
    String email = username + "@example.com";
    registerRaw(email, username, PASSWORD);

    mvc.perform(post("/api/auth/login").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("identifier", "missing-" + email, "password", PASSWORD))))
      .andExpect(status().isUnauthorized());

    mvc.perform(post("/api/auth/login").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("identifier", email, "password", "wrong-password"))))
      .andExpect(status().isUnauthorized());

    mvc.perform(post("/api/auth/login").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("identifier", email, "password", PASSWORD))))
      .andExpect(status().isForbidden());
  }

  @Test
  void repeatedLoginAttemptsAreRateLimited() throws Exception {
    String identifier = "ghost-" + UUID.randomUUID() + "@example.com";
    for (int attempt = 0; attempt < 10; attempt++) {
      mvc.perform(post("/api/auth/login").with(csrf())
          .contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("identifier", identifier, "password", "wrong-password"))))
        .andExpect(status().isUnauthorized());
    }
    mvc.perform(post("/api/auth/login").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("identifier", identifier, "password", "wrong-password"))))
      .andExpect(status().isTooManyRequests())
      .andExpect(header().exists("Retry-After"));
  }

  @Test
  void mailboxesMatchTheFrontendContract() throws Exception {
    SessionUser user = registerAndLogin(PASSWORD);
    String address = user.user().username + "@nf.com";

    mvc.perform(get("/api/mail/mailboxes").session(user.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[0].address").value(address))
      .andExpect(jsonPath("$[0].type").value("site"));

    mvc.perform(post("/api/mail/mailboxes").session(user.session()).with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("label", "Personal", "address", "outside@gmail.com"))))
      .andExpect(status().isBadRequest());
  }

  @Test
  void mailIsDeliveredAndPaged() throws Exception {
    SessionUser sender = registerAndLogin(PASSWORD);
    SessionUser recipient = registerAndLogin(PASSWORD);

    mvc.perform(post("/api/mail").session(sender.session()).with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of(
          "recipient", recipient.user().username + "@nf.com",
          "subject", "Integration test",
          "body", "A real message through the API."
        ))))
      .andExpect(status().isCreated());

    mvc.perform(get("/api/mail/inbox").session(recipient.session()).param("limit", "1"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("$[0].subject").value("Integration test"));
  }

  @Test
  void chatAccessAndAttachmentValidationAreEnforced() throws Exception {
    SessionUser alice = registerAndLogin(PASSWORD);
    SessionUser bob = registerAndLogin(PASSWORD);
    SessionUser outsider = registerAndLogin(PASSWORD);

    MvcResult created = mvc.perform(post("/api/chats").session(alice.session()).with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("name", "Bob", "kind", "dm", "peerId", bob.user().id))))
      .andExpect(status().isCreated())
      .andReturn();
    String chatId = json.readTree(created.getResponse().getContentAsString()).get("id").asText();

    mvc.perform(post("/api/chats/" + chatId + "/messages").session(alice.session()).with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("text", "hello"))))
      .andExpect(status().isCreated());

    mvc.perform(get("/api/chats/" + chatId + "/messages").session(bob.session()).param("limit", "50"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1));

    mvc.perform(get("/api/chats/" + chatId + "/messages").session(outsider.session()))
      .andExpect(status().isNotFound());

    String fakePng = "data:image/png;base64," + Base64.getEncoder().encodeToString("not a png".getBytes(StandardCharsets.UTF_8));
    mvc.perform(post("/api/chats/" + chatId + "/messages").session(alice.session()).with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of(
          "text", "",
          "attachmentName", "fake.png",
          "attachmentType", "image/png",
          "attachmentData", fakePng
        ))))
      .andExpect(status().isBadRequest());

    mvc.perform(post("/api/chats/" + chatId + "/messages").session(alice.session()).with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of(
          "text", "",
          "attachmentName", "pixel.png",
          "attachmentType", "image/png",
          "attachmentData", "data:image/png;base64," + PNG
        ))))
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.attachmentType").value("image/png"))
      .andExpect(jsonPath("$.attachmentData").value("data:image/png;base64," + PNG));
  }

  @Test
  void sessionEndpointReturnsTheSignedInUser() throws Exception {
    SessionUser user = registerAndLogin(PASSWORD);
    mvc.perform(get("/api/auth/session").session(user.session()))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.authenticated").value(true))
      .andExpect(jsonPath("$.user.username").value(user.user().username));
    assertThat(user.user().emailVerified).isTrue();
  }
}
