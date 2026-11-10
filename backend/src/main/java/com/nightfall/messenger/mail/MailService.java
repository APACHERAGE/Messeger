package com.nightfall.messenger.mail;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;

@Service
public class MailService {
  private static final Pattern MAILBOX_ADDRESS = Pattern.compile("(?i)[a-z0-9_]{3,24}@nf\\.com");
  private static final int MAX_PAGE_SIZE = 200;

  private final MailMessageRepository messages;
  private final AuthUserRepository users;

  public MailService(MailMessageRepository messages, AuthUserRepository users) {
    this.messages = messages;
    this.users = users;
  }

  public MailboxResponse mailbox(AuthUserEntity user) {
    return new MailboxResponse(addressOf(user));
  }

  public List<MailboxAccount> mailboxes(AuthUserEntity user) {
    return List.of(accountOf(user));
  }

  public MailboxAccount registerMailbox(AuthUserEntity user, String label, String address) {
    String cleanAddress = address == null ? "" : address.trim().toLowerCase(Locale.ROOT);
    if (!cleanAddress.equals(addressOf(user))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "External mailboxes are available only in local demo mode. Use your Nightfall address " + addressOf(user) + ".");
    }
    return accountOf(user);
  }

  @Transactional(readOnly = true)
  public List<MailMessageResponse> inbox(AuthUserEntity user, int requestedLimit, Instant before) {
    int limit = pageSize(requestedLimit);
    var page = PageRequest.of(0, limit);
    List<MailMessageEntity> messagesPage = before == null
      ? messages.findByRecipientIdOrderBySentAtDescIdDesc(user.id, page)
      : messages.findByRecipientIdAndSentAtLessThanOrderBySentAtDescIdDesc(user.id, before, page);
    return messagesPage.stream().map(MailService::response).toList();
  }

  @Transactional(readOnly = true)
  public List<MailMessageResponse> sent(AuthUserEntity user, int requestedLimit, Instant before) {
    int limit = pageSize(requestedLimit);
    var page = PageRequest.of(0, limit);
    List<MailMessageEntity> messagesPage = before == null
      ? messages.findBySenderIdOrderBySentAtDescIdDesc(user.id, page)
      : messages.findBySenderIdAndSentAtLessThanOrderBySentAtDescIdDesc(user.id, before, page);
    return messagesPage.stream().map(MailService::response).toList();
  }

  @Transactional
  public MailMessageResponse send(AuthUserEntity sender, MailController.SendMailRequest input) {
    if (!sender.emailVerified) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Verify your account before using Nightfall Mail.");
    }

    String recipientAddress = input.recipient().trim().toLowerCase(Locale.ROOT);
    if (!MAILBOX_ADDRESS.matcher(recipientAddress).matches()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use a Nightfall mailbox in the form username@nf.com.");
    }

    String recipientUsername = recipientAddress.substring(0, recipientAddress.indexOf('@'));
    AuthUserEntity recipient = users.findByUsernameIgnoreCase(recipientUsername)
      .filter(account -> account.emailVerified)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No registered Nightfall mailbox matches that address."));
    if (recipient.id.equals(sender.id)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose another Nightfall mailbox as the recipient.");
    }

    MailMessageEntity message = new MailMessageEntity();
    message.id = UUID.randomUUID().toString();
    message.senderId = sender.id;
    message.recipientId = recipient.id;
    message.senderAddress = addressOf(sender);
    message.recipientAddress = addressOf(recipient);
    message.senderName = displayName(sender);
    message.recipientName = displayName(recipient);
    message.subject = input.subject().trim();
    message.body = input.body();
    message.sentAt = Instant.now();
    return response(messages.save(message));
  }

  private static MailMessageResponse response(MailMessageEntity message) {
    return new MailMessageResponse(
      message.id,
      message.senderAddress,
      message.senderName,
      message.recipientAddress,
      message.recipientName,
      message.subject,
      message.body,
      message.sentAt
    );
  }

  private static String addressOf(AuthUserEntity user) {
    return user.username.toLowerCase(Locale.ROOT) + "@nf.com";
  }

  private static String displayName(AuthUserEntity user) {
    return (user.firstName + " " + user.lastName).trim();
  }

  private static int pageSize(int requested) {
    return Math.max(1, Math.min(requested, MAX_PAGE_SIZE));
  }

  private static MailboxAccount accountOf(AuthUserEntity user) {
    return new MailboxAccount(user.id, "Nightfall Mail", addressOf(user), "site", Instant.EPOCH);
  }

  public record MailboxResponse(String address) {}

  public record MailboxAccount(String id, String label, String address, String type, Instant createdAt) {}

  public record MailMessageResponse(
    String id,
    String senderAddress,
    String senderName,
    String recipientAddress,
    String recipientName,
    String subject,
    String body,
    Instant sentAt
  ) {}
}
