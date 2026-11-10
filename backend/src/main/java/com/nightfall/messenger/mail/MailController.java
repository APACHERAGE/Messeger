package com.nightfall.messenger.mail;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import com.nightfall.messenger.auth.AuthUserEntity;

@RestController
@RequestMapping("/api/mail")
public class MailController {
  private final MailService mail;

  public MailController(MailService mail) {
    this.mail = mail;
  }

  public record SendMailRequest(
    @NotBlank @Pattern(regexp = "(?i)[a-z0-9_]{3,24}@nf\\.com") @Size(max = 31) String recipient,
    @NotBlank @Size(max = 160) String subject,
    @NotBlank @Size(max = 20000) String body
  ) {}
  public record RegisterMailboxRequest(
    @Size(max = 64) String label,
    @NotBlank @Size(max = 64) String address
  ) {}

  @GetMapping("/mailbox")
  public MailService.MailboxResponse mailbox(Authentication authentication) {
    return mail.mailbox(authenticatedUser(authentication));
  }

  @GetMapping("/mailboxes")
  public List<MailService.MailboxAccount> mailboxes(Authentication authentication) {
    return mail.mailboxes(authenticatedUser(authentication));
  }

  @PostMapping("/mailboxes")
  @ResponseStatus(HttpStatus.CREATED)
  public MailService.MailboxAccount registerMailbox(
    Authentication authentication,
    @Valid @RequestBody RegisterMailboxRequest input
  ) {
    return mail.registerMailbox(authenticatedUser(authentication), input.label(), input.address());
  }

  @GetMapping("/inbox")
  public List<MailService.MailMessageResponse> inbox(
    Authentication authentication,
    @RequestParam(defaultValue = "100") int limit,
    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant before
  ) {
    return mail.inbox(authenticatedUser(authentication), limit, before);
  }

  @GetMapping("/sent")
  public List<MailService.MailMessageResponse> sent(
    Authentication authentication,
    @RequestParam(defaultValue = "100") int limit,
    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant before
  ) {
    return mail.sent(authenticatedUser(authentication), limit, before);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public MailService.MailMessageResponse send(
    Authentication authentication,
    @Valid @RequestBody SendMailRequest input
  ) {
    return mail.send(authenticatedUser(authentication), input);
  }

  private static AuthUserEntity authenticatedUser(Authentication authentication) {
    if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserEntity user)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to use Nightfall Mail.");
    }
    return user;
  }
}
