package com.nightfall.messenger.chat;

import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import com.nightfall.messenger.media.DataUrlAttachment;
import com.nightfall.messenger.profile.ProfileEntity;
import com.nightfall.messenger.profile.ProfileRepository;
import com.nightfall.messenger.people.UserBlockRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/chats")
public class ChatController {
  private final ChatRepository chats;
  private final com.nightfall.messenger.people.SocialAccess access;
  private final MessageRepository messages;
  private final ChatParticipantRepository participants;
  private final AuthUserRepository users;
  private final ProfileRepository profiles;
  private final UserBlockRepository blocks;

  public ChatController(
    ChatRepository chats,
    com.nightfall.messenger.people.SocialAccess access,
    MessageRepository messages,
    ChatParticipantRepository participants,
    AuthUserRepository users,
    ProfileRepository profiles,
    UserBlockRepository blocks
  ) {
    this.chats = chats;
    this.access = access;
    this.messages = messages;
    this.participants = participants;
    this.users = users;
    this.profiles = profiles;
    this.blocks = blocks;
  }

  public record NewChat(@NotBlank @Size(max = 80) String name, @NotBlank String kind, @NotBlank String peerId) {}
  public record NewSelfChat(@NotBlank @Size(max = 80) String name) {}
  public record NewMessage(
    @Size(max = 4000) String text,
    @Size(max = 255) String attachmentName,
    @Size(max = 120) String attachmentType,
    @Size(max = 1_500_000) String attachmentData
  ) {
    @AssertTrue(message = "Message must include text or a file.")
    public boolean isNotEmpty() {
      return (text != null && !text.isBlank()) || (attachmentName != null && !attachmentName.isBlank() && attachmentData != null && !attachmentData.isBlank());
    }
  }
  public record EditMessage(@NotBlank @Size(max = 4000) String text) {}
  public record ChatSummary(
    String id, String name, String handle, String avatar, String accent, String lastMessage, String time,
    int unread, boolean online, String kind, String peerId, boolean pinned, java.time.Instant updatedAt
  ) {}
  public record MessageResponse(
    String id, String author, String avatar, String text, String time, boolean own,
    String attachmentName, String attachmentType, String attachmentData, boolean edited, long createdAt
  ) {}

  private ChatEntity findChat(String id, AuthUserEntity user) {
    ChatEntity chat = chats.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat not found"));
    if ("dm".equals(chat.kind)) {
      if (participants.findByChatIdAndUserId(id, user.id).isPresent()
        || user.id.equals(chat.ownerId) || user.id.equals(chat.peerId)) {
        if (isBlockedForEitherParticipant(chat)) {
          throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This conversation is unavailable because one participant blocked the other.");
        }
        return chat;
      }
    } else if (user.id.equals(chat.ownerId)) {
      return chat;
    }
    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat not found");
  }

  private boolean isBlockedForEitherParticipant(ChatEntity chat) {
    return chat.peerId != null && (blocks.existsByOwnerIdAndBlockedUserId(chat.ownerId, chat.peerId)
      || blocks.existsByOwnerIdAndBlockedUserId(chat.peerId, chat.ownerId));
  }

  private void addParticipant(String chatId, String userId) {
    participants.findByChatIdAndUserId(chatId, userId).orElseGet(() -> participants.save(new ChatParticipantEntity(chatId, userId)));
  }

  private String displayName(AuthUserEntity user) {
    ProfileEntity profile = profiles.findById(user.id).orElse(null);
    String name = profile == null ? "" : profile.displayName.trim();
    if (name.isEmpty() && profile == null) name = (user.firstName + " " + user.lastName).trim();
    return name.isEmpty() ? user.username : name;
  }

  private ChatSummary summary(ChatEntity chat, AuthUserEntity user) {
    String name = chat.name;
    String handle = chat.handle;
    String peerId = chat.peerId;
    int unread = chat.unread;
    if ("dm".equals(chat.kind)) {
      peerId = user.id.equals(chat.ownerId) ? chat.peerId : chat.ownerId;
      AuthUserEntity peer = users.findById(peerId).orElse(null);
      if (peer != null) {
        name = displayName(peer);
        handle = peer.username;
      }
      addParticipant(chat.id, chat.ownerId);
      if (chat.peerId != null) addParticipant(chat.id, chat.peerId);
      long lastReadAt = participants.findByChatIdAndUserId(chat.id, user.id)
        .map(participant -> participant.lastReadAt).orElse(0L);
      unread = (int) messages.countByChatIdAndSenderIdNotAndCreatedAtGreaterThan(chat.id, user.id, lastReadAt);
    }
    return new ChatSummary(chat.id, name, handle, chat.avatar, chat.accent, chat.lastMessage, chat.time,
      unread, chat.online, chat.kind, peerId, chat.pinned, chat.updatedAt);
  }

  private MessageResponse messageResponse(MessageEntity message, AuthUserEntity user) {
    boolean own = message.senderId == null ? message.own : user.id.equals(message.senderId);
    return new MessageResponse(message.id, message.author, message.avatar, message.text, message.time, own,
      message.attachmentName, message.attachmentType, message.attachmentData, message.edited, message.createdAt);
  }

  @GetMapping
  @Transactional
  public List<ChatSummary> list(@AuthenticationPrincipal AuthUserEntity user) {
    LinkedHashMap<String, ChatEntity> visible = new LinkedHashMap<>();
    chats.findByOwnerIdOrPeerId(user.id, user.id).forEach(chat -> {
      if ((! "dm".equals(chat.kind) || user.id.equals(chat.ownerId) || user.id.equals(chat.peerId))
        && !("dm".equals(chat.kind) && isBlockedForEitherParticipant(chat))) visible.put(chat.id, chat);
    });
    participants.findByUserId(user.id).stream()
      .map(participant -> chats.findById(participant.chatId).orElse(null))
      .filter(chat -> chat != null && "dm".equals(chat.kind) && !isBlockedForEitherParticipant(chat))
      .forEach(chat -> visible.put(chat.id, chat));
    return visible.values().stream()
      .map(chat -> summary(chat, user))
      .sorted(Comparator.comparing(ChatSummary::pinned).reversed().thenComparing(ChatSummary::name, String.CASE_INSENSITIVE_ORDER))
      .toList();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public ChatSummary create(@Valid @RequestBody NewChat input, @AuthenticationPrincipal AuthUserEntity user) {
    if (!"dm".equals(input.kind())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only direct messages with a recipient can be created here.");
    if (input.peerId().equals(user.id)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use My Chat to message yourself.");
    AuthUserEntity peer = users.findById(input.peerId())
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "That account cannot receive Nightfall messages."));
    if (!access.message(peer.id,user.id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This account does not allow messages from you.");
    List<ChatEntity> existing = chats.findByOwnerIdOrPeerId(user.id, user.id);
    ChatEntity chat = existing.stream().filter(item -> "dm".equals(item.kind)
      && ((user.id.equals(item.ownerId) && peer.id.equals(item.peerId))
        || (peer.id.equals(item.ownerId) && user.id.equals(item.peerId)))).findFirst().orElse(null);
    if (chat == null) {
      String name = displayName(peer);
      chat = new ChatEntity(UUID.randomUUID().toString(), name, name.substring(0, 1).toUpperCase(Locale.ROOT), "violet", "dm");
      chat.ownerId = user.id;
      chat.peerId = peer.id;
      chat.handle = peer.username;
      chat = chats.save(chat);
    }
    addParticipant(chat.id, user.id);
    addParticipant(chat.id, peer.id);
    return summary(chat, user);
  }

  @PostMapping("/self")
  @Transactional
  public ChatSummary self(@AuthenticationPrincipal AuthUserEntity user) {
    String selfPeerId = "self:" + user.id;
    ChatEntity chat = chats.findByPeerIdAndOwnerId(selfPeerId, user.id).orElseGet(() -> {
      ChatEntity created = new ChatEntity(UUID.randomUUID().toString(), "My Chat", "N", "green", "self");
      created.peerId = selfPeerId;
      created.ownerId = user.id;
      created.pinned = true;
      created.lastMessage = "Private notes and files";
      return chats.save(created);
    });
    return summary(chat, user);
  }

  @PostMapping("/self/named")
  @ResponseStatus(HttpStatus.CREATED)
  public ChatSummary createSelf(@Valid @RequestBody NewSelfChat input, @AuthenticationPrincipal AuthUserEntity user) {
    String name = input.name().trim();
    if (name.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a name for your private chat.");
    ChatEntity chat = new ChatEntity(UUID.randomUUID().toString(), name, name.substring(0, 1).toUpperCase(), "green", "self");
    chat.peerId = "self:" + user.id + ":" + UUID.randomUUID();
    chat.ownerId = user.id;
    chat.lastMessage = "Private notes and files";
    return summary(chats.save(chat), user);
  }

  @GetMapping("/{chatId}/messages")
  @Transactional(readOnly = true)
  public List<MessageResponse> messages(
    @PathVariable String chatId,
    @RequestParam(defaultValue = "100") int limit,
    @RequestParam(required = false) Long before,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    findChat(chatId, user);
    int size = Math.max(1, Math.min(limit, 100));
    Pageable page = PageRequest.of(0, size);
    List<MessageEntity> result = before == null
      ? messages.findByChatIdOrderByCreatedAtDescIdDesc(chatId, page)
      : messages.findByChatIdAndCreatedAtLessThanOrderByCreatedAtDescIdDesc(chatId, before, page);
    Collections.reverse(result);
    return result.stream().map(message -> messageResponse(message, user)).toList();
  }

  @PostMapping("/{chatId}/messages")
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public MessageResponse send(@PathVariable String chatId, @Valid @RequestBody NewMessage input, @AuthenticationPrincipal AuthUserEntity user) {
    ChatEntity chat = findChat(chatId, user);
    if ("dm".equals(chat.kind)) {
      String recipient=user.id.equals(chat.ownerId)?chat.peerId:chat.ownerId;
      if (!access.message(recipient,user.id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This account does not allow messages from you.");
    }
    String text = input.text() == null ? "" : input.text().trim();
    String attachmentName = input.attachmentName() == null ? null : input.attachmentName().trim();
    String attachmentType = input.attachmentType() == null ? null : input.attachmentType().trim();
    String attachmentData = input.attachmentData() == null ? null : input.attachmentData().trim();
    boolean hasAttachmentMetadata = (attachmentName != null && !attachmentName.isBlank())
      || (attachmentType != null && !attachmentType.isBlank())
      || (attachmentData != null && !attachmentData.isBlank());
    DataUrlAttachment.Validated attachment = null;
    if (hasAttachmentMetadata) {
      attachment = DataUrlAttachment.parse(attachmentName, attachmentType, attachmentData, 1_000_000, DataUrlAttachment.CHAT_TYPES);
    }
    String time = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"));
    MessageEntity message = new MessageEntity(UUID.randomUUID().toString(), chatId, displayName(user),
      user.username.substring(0, 1).toUpperCase(Locale.ROOT), text, time, true);
    message.senderId = user.id;
    if (attachment != null) {
      message.attachmentName = attachment.name();
      message.attachmentType = attachment.mimeType();
      message.attachmentData = attachment.dataUrl();
    }
    messages.save(message);
    chat.lastMessage = text.isEmpty() ? "File: " + attachmentName : text;
    chat.time = time;
    chat.updatedAt = java.time.Instant.now();
    chats.save(chat);
    return messageResponse(message, user);
  }

  @PutMapping("/{chatId}/messages/{messageId}")
  @Transactional
  public MessageResponse editMessage(
    @PathVariable String chatId,
    @PathVariable String messageId,
    @Valid @RequestBody EditMessage input,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    findChat(chatId, user);
    MessageEntity message = messages.findById(messageId)
      .filter(item -> chatId.equals(item.chatId) && user.id.equals(item.senderId))
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found."));
    message.text = input.text().trim();
    message.edited = true;
    messages.save(message);
    ChatEntity chat = chats.findById(chatId).orElseThrow();
    if (messages.findTopByChatIdOrderByCreatedAtDescIdDesc(chatId).map(last -> last.id.equals(message.id)).orElse(false)) {
      chat.lastMessage = message.text;
      chats.save(chat);
    }
    return messageResponse(message, user);
  }

  @DeleteMapping("/{chatId}/messages/{messageId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void deleteMessage(@PathVariable String chatId, @PathVariable String messageId, @AuthenticationPrincipal AuthUserEntity user) {
    findChat(chatId, user);
    MessageEntity message = messages.findById(messageId)
      .filter(item -> chatId.equals(item.chatId) && user.id.equals(item.senderId))
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found."));
    messages.delete(message);
    ChatEntity chat = chats.findById(chatId).orElseThrow();
    MessageEntity last = messages.findTopByChatIdOrderByCreatedAtDescIdDesc(chatId).orElse(null);
    chat.lastMessage = last == null ? "Say hello" : (last.text == null || last.text.isBlank() ? "File: " + last.attachmentName : last.text);
    chats.save(chat);
  }

  @PostMapping("/{chatId}/read")
  @Transactional
  public ChatSummary read(@PathVariable String chatId, @AuthenticationPrincipal AuthUserEntity user) {
    ChatEntity chat = findChat(chatId, user);
    if ("dm".equals(chat.kind)) {
      ChatParticipantEntity participant = participants.findByChatIdAndUserId(chatId, user.id)
        .orElseGet(() -> participants.save(new ChatParticipantEntity(chatId, user.id)));
      participant.lastReadAt = System.currentTimeMillis();
      participants.save(participant);
    } else {
      chat.unread = 0;
      chats.save(chat);
    }
    return summary(chat, user);
  }
}
