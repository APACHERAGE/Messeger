package com.nightfall.messenger.channels;

import com.nightfall.messenger.profile.PublicIdentity;
import com.nightfall.messenger.media.DataUrlAttachment;

import com.nightfall.messenger.auth.AuthUserEntity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/channels")
public class ChannelsController {
  private final ChannelAccess access;
  private final ChannelCommentRepository comments;
  private final PublicIdentity identity;
  private final ChannelRepository channels;
  private final ChannelFollowRepository follows;
  private final ChannelPostRepository posts;
  private final com.nightfall.messenger.auth.AuthUserRepository users;

  public ChannelsController(
    ChannelAccess access, ChannelCommentRepository comments,
    PublicIdentity identity,
    ChannelRepository channels,
    ChannelFollowRepository follows,
    ChannelPostRepository posts,
    com.nightfall.messenger.auth.AuthUserRepository users
  ) {
    this.access=access; this.comments=comments;
    this.identity = identity;
    this.channels = channels;
    this.follows = follows;
    this.posts = posts;
    this.users = users;
  }

  public record NewChannel(@NotBlank @Size(max = 72) String title, @Size(max = 240) String description) {}
  public record NewPost(
    @Size(max = 2000) String body,
    @Size(max = 2048) String link,
    @Size(max = 255) String attachmentName,
    @Size(max = 120) String attachmentType,
    @Size(max = 1_500_000) String attachmentData
  ) {}
  public record ChannelPost(
    String id,
    String author,
    String username,
    String body,
    Instant createdAt,
    String link,
    String attachmentName,
    String attachmentType,
    String attachmentData, boolean pinned, boolean commentsEnabled, long commentCount, Instant editedAt
  ) {}
  public record ChannelSummary(
    String id,
    String title,
    String handle,
    String description,
    String ownerId,
    String ownerName,
    String ownerUsername,
    long followers,
    boolean subscribed,
    Instant createdAt, boolean commentsEnabled
  ) {}
  public record ChannelDetail(ChannelSummary channel, List<ChannelPost> posts) {}

  @GetMapping
  @Transactional(readOnly = true)
  public List<ChannelSummary> list(@AuthenticationPrincipal AuthUserEntity user) {
    var followed = follows.findByUserId(user.id).stream().map(follow -> follow.channelId).collect(java.util.stream.Collectors.toSet());
    List<ChannelEntity> allChannels = channels.findAllByOrderByCreatedAtDesc();
    var owners = users.findAllById(allChannels.stream().map(channel -> channel.ownerId).distinct().toList()).stream()
      .collect(java.util.stream.Collectors.toMap(owner -> owner.id, owner -> owner));
    var followerCounts = follows.countByChannelIds(allChannels.stream().map(channel -> channel.id).toList()).stream()
      .collect(java.util.stream.Collectors.toMap(ChannelFollowRepository.FollowerCount::getChannelId, ChannelFollowRepository.FollowerCount::getTotal));
    return allChannels.stream()
      .map(channel -> summary(channel, user.id, followed.contains(channel.id), owners.get(channel.ownerId), followerCounts.getOrDefault(channel.id, 0L)))
      .toList();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public ChannelSummary create(@Valid @RequestBody NewChannel input, @AuthenticationPrincipal AuthUserEntity user) {
    String id = UUID.randomUUID().toString();
    String handle = user.username.toLowerCase(java.util.Locale.ROOT) + "-" + id.substring(0, 8);
    ChannelEntity channel = new ChannelEntity();
    channel.id = id;
    channel.title = input.title().trim();
    channel.handle = handle;
    channel.description = input.description() == null ? "" : input.description().trim();
    channel.ownerId = user.id;
    channel.createdAt = Instant.now();
    channels.save(channel);
    follows.save(new ChannelFollowEntity(channel.id, user.id));
    return summary(channel, user.id, true);
  }

  @GetMapping("/{channelId}")
  @Transactional(readOnly = true)
  public ChannelDetail get(
    @PathVariable String channelId,
    @RequestParam(defaultValue = "50") int limit,
    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant before,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    ChannelEntity channel = findChannel(channelId);
    boolean subscribed = follows.existsById(channel.id + ":" + user.id);
    int size = Math.max(1, Math.min(limit, 100));
    Pageable page = PageRequest.of(0, size);
    List<ChannelPostEntity> pagePosts = before == null
      ? posts.findByChannelIdOrderByCreatedAtDesc(channel.id, page)
      : posts.findByChannelIdAndCreatedAtLessThanOrderByCreatedAtDesc(channel.id, before, page);
    var authors = users.findAllById(pagePosts.stream().map(post -> post.authorId).distinct().toList()).stream()
      .collect(java.util.stream.Collectors.toMap(author -> author.id, author -> author));
    List<ChannelPost> channelPosts = pagePosts.stream()
      .map(post -> toPost(post, authors.get(post.authorId)))
      .toList();
    return new ChannelDetail(summary(channel, user.id, subscribed), channelPosts);
  }

  @PostMapping("/{channelId}/follow")
  @Transactional
  public ChannelSummary follow(@PathVariable String channelId, @AuthenticationPrincipal AuthUserEntity user) {
    ChannelEntity channel = access.lock(channelId);
    follows.saveIfAbsent(channel.id + ":" + user.id, channel.id, user.id);
    return summary(channel, user.id, true);
  }

  @DeleteMapping("/{channelId}/follow")
  @Transactional
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void unfollow(@PathVariable String channelId, @AuthenticationPrincipal AuthUserEntity user) {
    ChannelEntity channel=access.lock(channelId);
    if (channel.ownerId.equals(user.id)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Transfer ownership before leaving, or delete the channel.");
    follows.deleteByIdAndUserId(channelId + ":" + user.id, user.id);
  }

  @PostMapping("/{channelId}/posts")
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public ChannelPost publish(
    @PathVariable String channelId,
    @Valid @RequestBody NewPost input,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    findOwnedChannel(channelId, user.id);
    String body = input.body() == null ? "" : input.body().trim();
    String link = input.link() == null ? "" : input.link().trim();
    boolean hasAttachment = input.attachmentName() != null && !input.attachmentName().isBlank()
      && input.attachmentData() != null && !input.attachmentData().isBlank();
    if (body.isEmpty() && link.isEmpty() && !hasAttachment) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add text, a link, or an attachment.");
    }
    if (!link.isEmpty()) {
      try {
        URI uri = URI.create(link);
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) || uri.getHost() == null) {
          throw new IllegalArgumentException();
        }
      } catch (IllegalArgumentException exception) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Link must be a valid http:// or https:// URL.");
      }
    }
    if (hasAttachment && (input.attachmentType() == null || input.attachmentType().isBlank()
      || input.attachmentData() == null || input.attachmentData().isBlank())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attachment metadata is incomplete.");
    }
    DataUrlAttachment.Validated attachment = null;
    boolean hasAttachmentMetadata = (input.attachmentName() != null && !input.attachmentName().isBlank())
      || (input.attachmentType() != null && !input.attachmentType().isBlank())
      || (input.attachmentData() != null && !input.attachmentData().isBlank());
    if (hasAttachmentMetadata) {
      attachment = DataUrlAttachment.parse(input.attachmentName(), input.attachmentType(), input.attachmentData(), 1_000_000, DataUrlAttachment.CHANNEL_TYPES);
    }
    if (!hasAttachment && (input.attachmentName() != null || input.attachmentType() != null || input.attachmentData() != null)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attachment metadata is incomplete.");
    }
    ChannelPostEntity post = new ChannelPostEntity();
    post.id = UUID.randomUUID().toString();
    post.channelId = channelId;
    post.authorId = user.id;
    post.body = body;
    post.link = link.isEmpty() ? null : link;
    if (attachment != null) {
      post.attachmentName = attachment.name();
      post.attachmentType = attachment.mimeType();
      post.attachmentData = attachment.dataUrl();
    }
    post.createdAt = Instant.now();
    return toPost(posts.save(post), user);
  }

  private ChannelEntity findChannel(String id) {
    return channels.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found."));
  }

  private ChannelEntity findOwnedChannel(String id, String ownerId) {
    return access.owned(id, ownerId);
  }

  private ChannelSummary summary(ChannelEntity channel, String userId, boolean subscribed) {
    return summary(channel, userId, subscribed, users.findById(channel.ownerId).orElse(null), follows.countByChannelId(channel.id));
  }

  private ChannelSummary summary(ChannelEntity channel, String userId, boolean subscribed, AuthUserEntity owner, long followers) {
    String ownerName = identity.name(owner);
    String ownerUsername = owner == null ? "nightfall" : owner.username;
    return new ChannelSummary(
      channel.id, channel.title, channel.handle, channel.description, channel.ownerId, ownerName, ownerUsername,
      followers, subscribed, channel.createdAt, channel.commentsEnabled
    );
  }

  private ChannelPost toPost(ChannelPostEntity post, AuthUserEntity author) {
    String authorName = identity.name(author);
    String authorUsername = author == null ? "nightfall" : author.username;
    return new ChannelPost(
      post.id, authorName + " · @" + authorUsername, authorUsername, post.body, post.createdAt,
      post.link, post.attachmentName, post.attachmentType, post.attachmentData, post.pinned, post.commentsEnabled, comments.countByPostIdAndRemovedFalse(post.id), post.editedAt
    );
  }
}
