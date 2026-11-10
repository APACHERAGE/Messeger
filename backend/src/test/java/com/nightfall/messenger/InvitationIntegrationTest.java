package com.nightfall.messenger;

import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nightfall.messenger.auth.RateLimitService;
import com.nightfall.messenger.auth.RegistrationMailService;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {
  "app.auth.invite-code=friend-code",
  "app.auth.email-verification=off",
  "app.mail.mode=smtp",
  "spring.datasource.url=jdbc:h2:mem:nightfall-invite-test;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InvitationIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired RateLimitService rateLimit;
  @MockitoBean RegistrationMailService mail;

  @BeforeEach
  void resetRateLimits() {
    rateLimit.clear();
  }

  @Test
  void invitationNeedsLoginAndSendsToRequestedEmail() throws Exception {
    mvc.perform(get("/api/auth/config"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.invitationsAvailable").value(true));

    mvc.perform(post("/api/auth/invite").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"friend@example.test\"}"))
      .andExpect(status().isUnauthorized());

    String username = "test" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    String password = "friends-only-password";
    mvc.perform(post("/api/auth/register").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of(
          "firstName", "Alice", "lastName", "", "username", username,
          "email", username + "@example.test", "password", password,
          "confirmPassword", password, "inviteCode", "friend-code"
        ))))
      .andExpect(status().isAccepted());

    MvcResult login = mvc.perform(post("/api/auth/login").with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("identifier", username, "password", password))))
      .andExpect(status().isOk())
      .andReturn();
    MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);

    mvc.perform(post("/api/auth/invite").session(session).with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"friend@example.test\"}"))
      .andExpect(status().isAccepted());
    verify(mail).sendInvitation("friend@example.test", "Alice", "friend-code");
  }
}
