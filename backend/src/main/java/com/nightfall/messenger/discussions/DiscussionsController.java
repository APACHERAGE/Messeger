package com.nightfall.messenger.discussions;

import com.nightfall.messenger.profile.PublicIdentity;

import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
@RequestMapping("/api/discussions")
public class DiscussionsController {
  private final PublicIdentity identity;
  private final DiscussionThreadRepository threads;
  private final DiscussionCommentRepository comments;
  private final DiscussionBookmarkRepository bookmarks;
  private final AuthUserRepository users;

  public DiscussionsController(
    PublicIdentity identity,
    DiscussionThreadRepository threads,
    DiscussionCommentRepository comments,
    DiscussionBookmarkRepository bookmarks,
    AuthUserRepository users
  ) {
    this.identity = identity;
    this.threads = threads;
    this.comments = comments;
    this.bookmarks = bookmarks;
    this.users = users;
  }

  public record NewThread(
    @NotBlank @Size(max = 140) String title,
    @NotBlank @Size(max = 5000) String body,
    @Size(max = 8) List<String> tags
  ) {}
  public record NewComment(@NotBlank @Size(max = 2000) String body, @Size(max = 36) String parentCommentId) {}
  public record ThreadStatus(boolean resolved) {}
  public record AcceptedAnswer(@Size(max = 36) String commentId) {}
  public record ThreadSummary(
    String id,
    String title,
    String body,
    String author,
    String username,
    long commentCount,
    Instant createdAt,
    Instant updatedAt,
    List<String> tags,
    boolean resolved,
    String acceptedAnswerId,
    boolean saved
  ) {}
  public record DiscussionComment(
    String id,
    String parentCommentId,
    String author,
    String username,
    String body,
    Instant createdAt
  ) {}
  public record ThreadDetail(ThreadSummary thread, List<DiscussionComment> comments) {}

  @GetMapping
  @Transactional(readOnly = true)
  public List<ThreadSummary> list(
    @RequestParam(defaultValue = "") String query,
    @RequestParam(defaultValue = "active") String sort,
    @RequestParam(defaultValue = "") String tag,
    @RequestParam(defaultValue = "false") boolean savedOnly,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    String needle = query.trim().toLowerCase(Locale.ROOT);
    String requestedTag = tag.trim().toLowerCase(Locale.ROOT);
    Set<String> savedThreadIds = bookmarks.findByUserId(user.id).stream()
      .map(bookmark -> bookmark.threadId)
      .collect(java.util.stream.Collectors.toSet());
    Comparator<ThreadSummary> order = switch (sort) {
      case "new" -> Comparator.comparing(ThreadSummary::createdAt).reversed();
      case "active" -> Comparator.comparingLong(ThreadSummary::commentCount).reversed()
        .thenComparing(ThreadSummary::updatedAt, Comparator.reverseOrder());
      default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown sort order.");
    };
    return threads.findAllByOrderByCreatedAtDesc().stream()
      .filter(thread -> !savedOnly || savedThreadIds.contains(thread.id))
      .map(thread -> summary(thread, savedThreadIds.contains(thread.id)))
      .filter(thread -> requestedTag.isEmpty()
        || thread.tags().stream().anyMatch(item -> item.toLowerCase(Locale.ROOT).equals(requestedTag)))
      .filter(thread -> needle.isEmpty()
        || thread.title().toLowerCase(Locale.ROOT).contains(needle)
        || thread.body().toLowerCase(Locale.ROOT).contains(needle)
        || thread.author().toLowerCase(Locale.ROOT).contains(needle)
        || thread.username().toLowerCase(Locale.ROOT).contains(needle)
        || thread.tags().stream().anyMatch(item -> item.toLowerCase(Locale.ROOT).contains(needle)))
      .sorted(order)
      .toList();
  }

  @GetMapping("/{threadId}")
  @Transactional(readOnly = true)
  public ThreadDetail get(@PathVariable String threadId, @AuthenticationPrincipal AuthUserEntity user) {
    DiscussionThreadEntity thread = findThread(threadId);
    List<DiscussionComment> threadComments = comments.findByThreadIdOrderByCreatedAtAscIdAsc(threadId).stream()
      .map(this::comment)
      .toList();
    return new ThreadDetail(summary(thread, isSaved(threadId, user.id)), threadComments);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public ThreadSummary create(@Valid @RequestBody NewThread input, @AuthenticationPrincipal AuthUserEntity user) {
    String title = input.title().trim();
    String body = input.body().trim();
    if (title.isEmpty() || body.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a thread title and body.");
    Instant now = Instant.now();
    DiscussionThreadEntity thread = new DiscussionThreadEntity();
    thread.id = UUID.randomUUID().toString();
    thread.title = title;
    thread.body = body;
    thread.tags = normalizeTags(input.tags());
    thread.authorId = user.id;
    thread.createdAt = now;
    thread.updatedAt = now;
    return summary(threads.save(thread), false);
  }

  @PostMapping("/{threadId}/comments")
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public DiscussionComment comment(
    @PathVariable String threadId,
    @Valid @RequestBody NewComment input,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    DiscussionThreadEntity thread = findThread(threadId);
    String body = input.body().trim();
    if (body.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment cannot be empty.");
    String parentId = input.parentCommentId();
    if (parentId != null && !parentId.isBlank()) {
      DiscussionCommentEntity parent = comments.findById(parentId)
        .filter(item -> item.threadId.equals(threadId))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reply target not found."));
      parentId = parent.id;
    } else {
      parentId = null;
    }

    DiscussionCommentEntity comment = new DiscussionCommentEntity();
    comment.id = UUID.randomUUID().toString();
    comment.threadId = threadId;
    comment.parentCommentId = parentId;
    comment.authorId = user.id;
    comment.body = body;
    comment.createdAt = Instant.now();
    thread.updatedAt = comment.createdAt;
    threads.save(thread);
    return comment(comments.save(comment));
  }

  @PatchMapping("/{threadId}/status")
  @Transactional
  public ThreadSummary setStatus(
    @PathVariable String threadId,
    @Valid @RequestBody ThreadStatus input,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    DiscussionThreadEntity thread = findThread(threadId);
    requireOwner(thread, user);
    thread.resolved = input.resolved();
    if (!thread.resolved) thread.acceptedAnswerId = null;
    return summary(threads.save(thread), isSaved(threadId, user.id));
  }

  @PutMapping("/{threadId}/accepted-answer")
  @Transactional
  public ThreadSummary setAcceptedAnswer(
    @PathVariable String threadId,
    @Valid @RequestBody AcceptedAnswer input,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    DiscussionThreadEntity thread = findThread(threadId);
    requireOwner(thread, user);
    String commentId = input.commentId();
    if (commentId != null && !commentId.isBlank()) {
      DiscussionCommentEntity answer = comments.findById(commentId)
        .filter(item -> item.threadId.equals(threadId))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Accepted answer must belong to this discussion."));
      thread.acceptedAnswerId = answer.id;
      thread.resolved = true;
    } else {
      thread.acceptedAnswerId = null;
    }
    return summary(threads.save(thread), isSaved(threadId, user.id));
  }

  @PutMapping("/{threadId}/bookmark")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void bookmark(@PathVariable String threadId, @AuthenticationPrincipal AuthUserEntity user) {
    findThread(threadId);
    if (bookmarks.findByUserIdAndThreadId(user.id, threadId).isEmpty()) {
      DiscussionBookmarkEntity bookmark = new DiscussionBookmarkEntity();
      bookmark.id = UUID.randomUUID().toString();
      bookmark.userId = user.id;
      bookmark.threadId = threadId;
      bookmarks.save(bookmark);
    }
  }

  @DeleteMapping("/{threadId}/bookmark")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void unbookmark(@PathVariable String threadId, @AuthenticationPrincipal AuthUserEntity user) {
    findThread(threadId);
    bookmarks.findByUserIdAndThreadId(user.id, threadId).ifPresent(bookmarks::delete);
  }

  private DiscussionThreadEntity findThread(String id) {
    return threads.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found."));
  }

  private void requireOwner(DiscussionThreadEntity thread, AuthUserEntity user) {
    if (!thread.authorId.equals(user.id)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the discussion author can update its solution status.");
    }
  }

  private boolean isSaved(String threadId, String userId) {
    return bookmarks.findByUserIdAndThreadId(userId, threadId).isPresent();
  }

  private List<String> normalizeTags(List<String> input) {
    if (input == null || input.isEmpty()) return List.of();
    List<String> normalized = input.stream()
      .map(tag -> tag == null ? "" : tag.trim().replaceAll("\\s+", " "))
      .filter(tag -> !tag.isEmpty())
      .distinct()
      .toList();
    if (normalized.size() > 8 || normalized.stream().anyMatch(tag -> tag.length() > 32
      || !tag.matches("[\\p{L}\\p{N}+#.-]+(?: [\\p{L}\\p{N}+#.-]+)*"))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tags must be up to 32 letters, numbers, spaces, or +#.- characters (8 maximum).");
    }
    return normalized;
  }

  private ThreadSummary summary(DiscussionThreadEntity thread, boolean saved) {
    AuthUserEntity author = users.findById(thread.authorId).orElse(null);
    String username = author == null ? "unknown" : author.username;
    return new ThreadSummary(
      thread.id, thread.title, thread.body, identity.name(author), username,
      comments.countByThreadId(thread.id), thread.createdAt, thread.updatedAt,
      thread.tags == null ? List.of() : List.copyOf(thread.tags), thread.resolved, thread.acceptedAnswerId, saved
    );
  }

  private DiscussionComment comment(DiscussionCommentEntity entity) {
    AuthUserEntity author = users.findById(entity.authorId).orElse(null);
    String displayName = identity.name(author);
    return new DiscussionComment(
      entity.id, entity.parentCommentId, displayName, author == null ? "unknown" : author.username,
      entity.body, entity.createdAt
    );
  }
}
