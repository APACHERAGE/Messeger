package com.nightfall.messenger.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;
  private final AuthUserRepository users;
  private final AuthenticationManager authenticationManager;
  private final SecurityContextRepository securityContextRepository;
  private final CsrfTokenRepository csrfTokenRepository;
  private final RateLimitService rateLimit;
  private final PasswordEncoder passwordEncoder;
  private final AuthSettings settings;
  private final RegistrationMailService mail;
  private final String dummyPasswordHash;

  public AuthController(
    AuthService auth,
    AuthUserRepository users,
    AuthenticationManager authenticationManager,
    SecurityContextRepository securityContextRepository,
    CsrfTokenRepository csrfTokenRepository,
    RateLimitService rateLimit,
    PasswordEncoder passwordEncoder,
    AuthSettings settings,
    RegistrationMailService mail
  ) {
    this.auth = auth;
    this.users = users;
    this.authenticationManager = authenticationManager;
    this.securityContextRepository = securityContextRepository;
    this.csrfTokenRepository = csrfTokenRepository;
    this.rateLimit = rateLimit;
    this.passwordEncoder = passwordEncoder;
    this.settings = settings;
    this.mail = mail;
    this.dummyPasswordHash = passwordEncoder.encode("nightfall-timing-equalizer");
  }

  public record RegisterRequest(
    @NotBlank @Size(max = 48) String firstName,
    @Size(max = 48) String lastName,
    @NotBlank @Pattern(regexp = "[A-Za-z0-9_]{3,24}") String username,
    @NotBlank @Email @Size(max = 254) String email,
    @NotBlank @Size(min = 10, max = 72) String password,
    @NotBlank @Size(min = 10, max = 72) String confirmPassword,
    @Size(max = 128) String inviteCode
  ) {
    @AssertTrue(message = "Passwords do not match.")
    public boolean isPasswordConfirmationValid() {
      return password != null && password.equals(confirmPassword);
    }
  }

  public record LoginRequest(@NotBlank @Size(max = 254) String identifier, @NotBlank @Size(max = 72) String password) {}
  public record VerifyRequest(@NotBlank @Size(max = 128) String token, @NotBlank @Size(min = 10, max = 72) String password) {}
  public record ResendVerificationRequest(@NotBlank @Email @Size(max = 254) String email) {}
  public record InviteRequest(@NotBlank @Email @Size(max = 254) String email) {}
  public record PasswordResetRequest(@NotBlank @Size(max = 254) String identifier) {}
  public record PasswordResetConfirm(
    @NotBlank @Size(max = 128) String token,
    @NotBlank @Size(min = 10, max = 72) String password,
    @NotBlank @Size(min = 10, max = 72) String confirmPassword
  ) {}
  public record AuthUser(String id, String firstName, String lastName, String username, String email) {}
  public record SessionResponse(boolean authenticated, AuthUser user) {}
  public record MessageResponse(String message) {}
  public record RegisterResponse(String message, boolean verificationRequired) {}
  public record CsrfResponse(String headerName, String token) {}
  public record AuthConfig(boolean inviteRequired, boolean emailVerificationRequired, boolean passwordResetAvailable, boolean invitationsAvailable) {}

  @GetMapping("/config")
  public AuthConfig config() {
    return new AuthConfig(settings.inviteRequired(), settings.emailVerificationRequired(), settings.passwordResetAvailable(), settings.invitationsAvailable());
  }

  @GetMapping("/csrf")
  public CsrfResponse csrf(CsrfToken token) {
    return new CsrfResponse(token.getHeaderName(), token.getToken());
  }

  @GetMapping("/session")
  public SessionResponse session(Authentication authentication) {
    if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserEntity user)) {
      return new SessionResponse(false, null);
    }
    return new SessionResponse(true, response(user));
  }

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public RegisterResponse register(@Valid @RequestBody RegisterRequest input, HttpServletRequest request) {
    String email = input.email().trim().toLowerCase(Locale.ROOT);
    rateLimit.check("register:ip:" + clientAddress(request), 10, Duration.ofHours(1));
    rateLimit.check("register:email:" + email, 5, Duration.ofHours(1));
    if (!settings.inviteMatches(input.inviteCode())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This Nightfall instance is invite-only. Enter a valid invite code.");
    }
    auth.register(input);
    if (!settings.emailVerificationRequired()) {
      return new RegisterResponse("Account created. You can sign in now.", false);
    }
    return new RegisterResponse(settings.consoleMail()
      ? "Development mode: find the verification link in the backend log. No email was sent."
      : "If this address can be registered, a welcome email with a verification link has been sent to it.", true);
  }

  @PostMapping("/resend-verification")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public MessageResponse resendVerification(@Valid @RequestBody ResendVerificationRequest input, HttpServletRequest request) {
    String email = input.email().trim().toLowerCase(Locale.ROOT);
    rateLimit.check("resend:ip:" + clientAddress(request), 10, Duration.ofHours(1));
    rateLimit.check("resend:email:" + email, 3, Duration.ofHours(1));
    auth.resendVerification(email);
    return new MessageResponse("If an unverified account matches that address, a new verification message has been sent.");
  }

  @PostMapping("/invite")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public MessageResponse invite(@Valid @RequestBody InviteRequest input, Authentication authentication, HttpServletRequest request) {
    if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserEntity user)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    if (!settings.invitationsAvailable()) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Email invitations need an invite code and SMTP configuration.");
    }
    String recipient = input.email().trim().toLowerCase(Locale.ROOT);
    rateLimit.check("invite:sender:" + user.id, 5, Duration.ofHours(1));
    rateLimit.check("invite:recipient:" + recipient, 3, Duration.ofHours(1));
    rateLimit.check("invite:ip:" + clientAddress(request), 20, Duration.ofHours(1));
    mail.sendInvitation(recipient, user.firstName, settings.inviteCode());
    return new MessageResponse("Invitation accepted by the mail server for " + recipient + ".");
  }

  @PostMapping("/verify")
  public MessageResponse verify(@Valid @RequestBody VerifyRequest input, HttpServletRequest request) {
    rateLimit.check("verify:ip:" + clientAddress(request), 30, Duration.ofHours(1));
    rateLimit.check("verify:token:" + Integer.toHexString(input.token().hashCode()), 10, Duration.ofHours(1));
    auth.verify(input.token(), input.password());
    return new MessageResponse("Email verified. You can now sign in.");
  }

  @PostMapping("/password-reset/request")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public MessageResponse requestPasswordReset(@Valid @RequestBody PasswordResetRequest input, HttpServletRequest request) {
    String identifier = input.identifier().trim().toLowerCase(Locale.ROOT);
    rateLimit.check("reset:ip:" + clientAddress(request), 10, Duration.ofHours(1));
    rateLimit.check("reset:id:" + identifier, 5, Duration.ofHours(1));
    auth.requestPasswordReset(input.identifier());
    return new MessageResponse("If a verified Nightfall account matches that email or username, a reset link has been sent.");
  }

  @PostMapping("/password-reset/confirm")
  public MessageResponse confirmPasswordReset(@Valid @RequestBody PasswordResetConfirm input, HttpServletRequest request) {
    rateLimit.check("reset-confirm:ip:" + clientAddress(request), 20, Duration.ofHours(1));
    rateLimit.check("reset-confirm:token:" + Integer.toHexString(input.token().hashCode()), 10, Duration.ofHours(1));
    auth.resetPassword(input.token(), input.password(), input.confirmPassword());
    return new MessageResponse("Password updated. You can now sign in.");
  }

  @PostMapping("/login")
  public SessionResponse login(
    @Valid @RequestBody LoginRequest input,
    HttpServletRequest request,
    HttpServletResponse response
  ) {
    String identifier = input.identifier().trim().toLowerCase(Locale.ROOT);
    rateLimit.check("login:ip:" + clientAddress(request), 30, Duration.ofMinutes(15));
    rateLimit.check("login:id:" + identifier, 10, Duration.ofMinutes(15));
    if (input.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect username or password.");
    }

    AuthUserEntity user = users.findByEmailIgnoreCase(identifier)
      .or(() -> users.findByUsernameIgnoreCase(identifier))
      .orElse(null);
    if (user == null) {
      // Equalize timing so unknown accounts cannot be distinguished from bad passwords.
      passwordEncoder.matches(input.password(), dummyPasswordHash);
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect username or password.");
    }
    if (!user.emailVerified) {
      // Only someone who knows the pending password learns that the account exists.
      if (!passwordEncoder.matches(input.password(), user.passwordHash)) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect username or password.");
      }
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Verify your email using the link we sent before signing in.");
    }

    Authentication authentication;
    try {
      authentication = authenticationManager.authenticate(
        new UsernamePasswordAuthenticationToken(identifier, input.password())
      );
    } catch (DisabledException exception) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Verify your email using the link we sent before signing in.");
    } catch (org.springframework.security.core.AuthenticationException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect username or password.");
    }

    request.getSession(true);
    request.changeSessionId();
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    securityContextRepository.saveContext(context, request, response);
    csrfTokenRepository.saveToken(null, request, response);
    AuthUserEntity authenticatedUser = (AuthUserEntity) authentication.getPrincipal();
    return new SessionResponse(true, response(authenticatedUser));
  }

  @PostMapping("/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(HttpServletRequest request, HttpServletResponse response) {
    SecurityContextHolder.clearContext();
    HttpSession session = request.getSession(false);
    if (session != null) session.invalidate();
    csrfTokenRepository.saveToken(null, request, response);
    response.setHeader("Clear-Site-Data", "\"cookies\"");
  }

  private static String clientAddress(HttpServletRequest request) {
    // The API binds to loopback by default, so only the local tunnel can reach
    // it. Cloudflare supplies CF-Connecting-IP; Tailscale and other local
    // reverse proxies supply X-Forwarded-For. Fall back to the socket address.
    // Do not expose this build directly on a public interface without a proxy
    // that overwrites these headers.
    String remote = bounded(request.getRemoteAddr());
    // A LAN client connects directly and may forge forwarding headers.
    // Only the local tunnel process is allowed to supply a client address.
    if (!"127.0.0.1".equals(remote) && !"::1".equals(remote)) return remote;
    String cloudflare = request.getHeader("CF-Connecting-IP");
    if (cloudflare != null && !cloudflare.isBlank()) return bounded(cloudflare);
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) return bounded(forwarded.split(",")[0]);
    return remote;
  }

  private static String bounded(String value) {
    if (value == null || value.isBlank()) return "unknown";
    String trimmed = value.trim();
    return trimmed.length() > 64 ? trimmed.substring(0, 64) : trimmed;
  }

  private static AuthUser response(AuthUserEntity user) {
    return new AuthUser(user.id, user.firstName, user.lastName, user.username, user.email);
  }
}
