package com.nightfall.messenger.auth;

import com.nightfall.messenger.chat.ChatController;
import com.nightfall.messenger.chat.ChatEntity;
import com.nightfall.messenger.chat.ChatRepository;
import com.nightfall.messenger.chat.MessageRepository;
import jakarta.validation.Validation;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

/** Local probes against actual application methods. No HTTP, real DB, SMTP or user accounts. */
public class SecurityProbe {
  static final Map<String, AuthUserEntity> accounts = new HashMap<>();
  static final Map<String, EmailVerificationEntity> tokens = new HashMap<>();
  static class CapturedMail extends RegistrationMailService {
    String latestToken;
    CapturedMail() { super(null); }
    @Override public void sendVerification(AuthUserEntity user, String token) { latestToken = token; }
  }
  static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
    return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler));
  }
  static void expect(boolean result, String name) {
    if (!result) throw new AssertionError(name);
    System.out.println("CONFIRMED: " + name);
  }
  static int rejected(Runnable operation) {
    try { operation.run(); return 0; }
    catch (ResponseStatusException error) { return error.getStatusCode().value(); }
  }
  static AuthController.RegisterRequest registration(String username, String email, String password) {
    return new AuthController.RegisterRequest("Test", "Account", username, email, password, password);
  }
  public static void main(String[] args) {
    var users = proxy(AuthUserRepository.class, (p,m,a) -> switch(m.getName()) {
      case "findByEmailIgnoreCase" -> accounts.values().stream().filter(u -> u.email.equalsIgnoreCase((String)a[0])).findFirst();
      case "findByUsernameIgnoreCase" -> accounts.values().stream().filter(u -> u.username.equalsIgnoreCase((String)a[0])).findFirst();
      case "existsByUsernameIgnoreCase" -> accounts.values().stream().anyMatch(u -> u.username.equalsIgnoreCase((String)a[0]));
      case "findById" -> Optional.ofNullable(accounts.get(a[0]));
      case "save" -> { var user = (AuthUserEntity)a[0]; accounts.put(user.id,user); yield user; }
      default -> throw new UnsupportedOperationException(m.getName());
    });
    var verifications = proxy(EmailVerificationRepository.class, (p,m,a) -> switch(m.getName()) {
      case "findByUserId" -> tokens.values().stream().filter(t -> t.userId.equals(a[0])).toList();
      case "findByTokenHash" -> Optional.ofNullable(tokens.get(a[0]));
      case "save" -> { var token = (EmailVerificationEntity)a[0]; tokens.put(token.tokenHash, token); yield token; }
      case "deleteAll" -> { for (var item : (Iterable<?>)a[0]) tokens.remove(((EmailVerificationEntity)item).tokenHash); yield null; }
      case "delete" -> { tokens.remove(((EmailVerificationEntity)a[0]).tokenHash); yield null; }
      default -> throw new UnsupportedOperationException(m.getName());
    });
    var encoder = new BCryptPasswordEncoder(12);
    var mail = new CapturedMail();
    var service = new AuthService(users, verifications, encoder, mail);

    service.register(registration("initial_holder", "owner@example.test", "InitialPassword123!"));
    String oldToken = mail.latestToken;
    service.register(registration("actual_owner", "owner@example.test", "OwnerChosenPassword123!"));
    String replacementToken = mail.latestToken;
    expect(rejected(() -> service.verify(oldToken)) == 400,
      "Unauthenticated repeated registration invalidates the previous verification link");
    service.verify(replacementToken);
    var account = users.findByEmailIgnoreCase("owner@example.test").orElseThrow();
    expect(account.emailVerified && encoder.matches("InitialPassword123!", account.passwordHash)
      && !encoder.matches("OwnerChosenPassword123!", account.passwordHash),
      "After owner verification, the initially registered password remains valid and the owner's submitted password is invalid");

    service.register(registration("pending_test", "pending@example.test", "TestPassword123!"));
    var controller = new AuthController(service, users,
      authentication -> { throw new BadCredentialsException("test"); }, null, null);
    expect(rejected(() -> controller.login(new AuthController.LoginRequest("pending@example.test", "wrong"), null, null)) == 403
      && rejected(() -> controller.login(new AuthController.LoginRequest("absent@example.test", "wrong"), null, null)) == 401,
      "Login distinguishes an unverified existing email from an unknown email without a correct password");

    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      String byteLimitPassword = "\uD83D\uDD12".repeat(18);
      service.register(registration("unicode_test", "unicode@example.test", byteLimitPassword));
      service.verify(mail.latestToken);
      var unicodeAccount = users.findByEmailIgnoreCase("unicode@example.test").orElseThrow();
      var login = new AuthController.LoginRequest("unicode@example.test", byteLimitPassword + "x");
      expect(byteLimitPassword.getBytes(StandardCharsets.UTF_8).length == 72
        && validator.validate(login).isEmpty()
        && encoder.matches(login.password(), unicodeAccount.passwordHash),
        "Login accepts a >72-byte Unicode password sharing the registered 72-byte prefix (BCrypt 6.4.2)");
      String oversizedFile = "data:application/octet-stream;base64," + Base64.getEncoder().encodeToString(new byte[1_050_000]);
      expect(validator.validate(new ChatController.NewMessage("", "test.bin", "application/octet-stream", oversizedFile)).isEmpty(),
        "Chat attachment DTO accepts a decoded 1,050,000-byte file despite the 1 MB UI limit");
      expect(validator.validate(new ChatController.NewMessage("note", "test.bin", "application/octet-stream", "https://example.invalid/file")).isEmpty(),
        "Chat attachment DTO accepts an arbitrary remote URL instead of requiring a validated data URL");
    }

    ChatEntity owned = new ChatEntity("test-chat", "Test", "T", "green", "self");
    owned.ownerId = account.id;
    var chatRepository = proxy(ChatRepository.class, (p,m,a) -> {
      if (m.getName().equals("findByIdAndOwnerId"))
        return owned.id.equals(a[0]) && owned.ownerId.equals(a[1]) ? Optional.of(owned) : Optional.empty();
      throw new UnsupportedOperationException(m.getName());
    });
    var messageRepository = proxy(MessageRepository.class, (p,m,a) -> {
      if (m.getName().equals("findByChatIdOrderByCreatedAtAscIdAsc")) return List.of();
      throw new UnsupportedOperationException(m.getName());
    });
    var chats = new ChatController(chatRepository, messageRepository);
    var other = new AuthUserEntity(); other.id = "another-account";
    expect(chats.messages(owned.id, account).isEmpty() && rejected(() -> chats.messages(owned.id, other)) == 404,
      "Positive control: chat access is restricted to its owner");
  }
}
