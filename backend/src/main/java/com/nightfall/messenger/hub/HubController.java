package com.nightfall.messenger.hub;

import com.nightfall.messenger.profile.PublicIdentity;

import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/hub")
public class HubController {
  private final PublicIdentity identity;
  private final HubPostPresenter presenter;
  private final HubAccess postAccess;
  private final com.nightfall.messenger.people.SocialAccess access;
  public record NewPost(@Size(max = 500) String body,@Size(max=36) String wallOwnerId,@jakarta.validation.constraints.Pattern(regexp="friends|public") String audience) {}
  public record NewComment(@NotBlank @Size(max = 1000) String body) {}
  public record HubComment(String id, String postId, String author, String username, String body, Instant createdAt) {}

  private final HubPostRepository posts;
  private final HubMediaRepository media;
  private final HubCommentRepository comments;
  private final HubReactionRepository reactions;
  private final AuthUserRepository users;

  public HubController(
    PublicIdentity identity,
    HubPostPresenter presenter,
    HubAccess postAccess,
    com.nightfall.messenger.people.SocialAccess access,
    HubPostRepository posts,
    HubMediaRepository media,
    HubCommentRepository comments,
    HubReactionRepository reactions,
    AuthUserRepository users
  ) {
    this.identity = identity;
    this.presenter=presenter;this.postAccess=postAccess;
    this.access = access;
    this.posts = posts;
    this.media = media;
    this.comments = comments;
    this.reactions = reactions;
    this.users = users;
  }

  @GetMapping("/posts")
  @Transactional(readOnly = true)
  public List<HubPostView> list(@RequestParam(required = false) String authorId, @AuthenticationPrincipal AuthUserEntity user) {
    if (authorId != null && !authorId.isBlank()) {
      if (!access.wall(authorId,user.id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"This wall is only available to its owner and friends.");
      return posts.findWall(authorId,org.springframework.data.domain.PageRequest.of(0,100)).stream().filter(post->postAccess.read(post,user.id)).map(post -> summary(post,user.id)).toList();
    }
    Set<String> ids=access.friendIds(user.id); ids.add(user.id);
    return posts.findTimeline(ids,org.springframework.data.domain.PageRequest.of(0,100)).stream().filter(post->postAccess.read(post,user.id)).map(post -> summary(post,user.id)).toList();
  }

  @PostMapping(value = "/posts", consumes = MediaType.APPLICATION_JSON_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public HubPostView create(@Valid @RequestBody NewPost input, @AuthenticationPrincipal AuthUserEntity user) {
    return createPost(input.body(), List.of(), input.wallOwnerId(),input.audience(),user);
  }

  @PostMapping(value = "/posts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public HubPostView createWithMedia(
    @RequestParam(defaultValue = "") String body,
    @RequestParam(required=false) String wallOwnerId,
    @RequestParam(defaultValue="friends") String audience,
    @RequestParam(name = "files", required = false) List<MultipartFile> files,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    return createPost(body, files == null ? List.of() : files,wallOwnerId,audience,user);
  }

  private HubPostView createPost(String input,List<MultipartFile> files,String target,String requestedAudience,AuthUserEntity user) {
    String body = input == null ? "" : input.trim();
    if (body.length() > 500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Post text must be 500 characters or fewer.");
    if (body.isEmpty() && files.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add text, a photo, a GIF, or a video to your post.");
    String owner=target==null||target.isBlank()?user.id:target;
    if(!users.existsById(owner))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Wall owner not found.");
    if(!access.postToWall(owner,user.id))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This wall does not accept posts from you.");
    String audience=requestedAudience==null?"friends":requestedAudience;
    if(!java.util.Set.of("friends","public").contains(audience))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose friends-only or public visibility.");
    if(!owner.equals(user.id)&&!"friends".equals(audience))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Posts on someone else’s wall are friends-only.");
    HubMediaValidation.validate(files);
    HubPostEntity post = new HubPostEntity();
    post.id = UUID.randomUUID().toString();
    post.authorId = user.id;
    post.wallOwnerId=owner;post.audience=audience;
    post.body = body;
    post.createdAt = Instant.now();
    posts.save(post);
    for (int index = 0; index < files.size(); index++) {
      MultipartFile file = files.get(index);
      HubMediaEntity item = new HubMediaEntity();
      item.id = UUID.randomUUID().toString();
      item.postId = post.id;
      item.name = HubMediaValidation.filename(file);
      item.type = file.getContentType();
      item.size = file.getSize();
      item.ordinal = index;
      try { item.data = file.getBytes(); }
      catch (IOException error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read an attachment."); }
      media.save(item);
    }
    return summary(post, user.id);
  }

  @GetMapping("/posts/{postId}/media/{mediaId}")
  @Transactional(readOnly = true)
  public ResponseEntity<Resource> media(
    @PathVariable String postId, @PathVariable String mediaId, @AuthenticationPrincipal AuthUserEntity user
  ) {
    visiblePost(postId, user);
    HubMediaEntity item = media.findByIdAndPostId(mediaId, postId)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found."));
    return ResponseEntity.ok()
      .contentType(MediaType.parseMediaType(item.type))
      .contentLength(item.size)
      .cacheControl(CacheControl.noStore())
      .header("X-Content-Type-Options", "nosniff")
      .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(item.name, StandardCharsets.UTF_8).build().toString())
      .body(new ByteArrayResource(item.data));
  }

  @PutMapping("/posts/{postId}")
  @Transactional
  public HubPostView update(
    @PathVariable String postId,
    @Valid @RequestBody NewPost input,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    HubPostEntity post = ownedPost(postId, user);
    String body = input.body() == null ? "" : input.body().trim();
    if (body.isEmpty() && !media.existsByPostId(postId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A text-only post cannot be empty.");
    post.body = body;
    return summary(posts.save(post), user.id);
  }

  @DeleteMapping("/posts/{postId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void delete(@PathVariable String postId, @AuthenticationPrincipal AuthUserEntity user) {
    HubPostEntity post=posts.findById(postId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Post not found."));
    if(!postAccess.delete(post,user.id))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the author or wall owner can remove this post.");
    comments.deleteByPostId(postId);
    reactions.deleteByPostId(postId);
    media.deleteByPostId(postId);
    posts.delete(post);
  }

  @PostMapping("/posts/{postId}/reactions")
  @Transactional
  public HubPostView toggleReaction(@PathVariable String postId, @AuthenticationPrincipal AuthUserEntity user) {
    HubPostEntity post = visiblePost(postId, user);
    if (reactions.existsByPostIdAndUserId(postId, user.id)) {
      reactions.deleteByPostIdAndUserId(postId, user.id);
    } else {
      reactions.save(new HubReactionEntity(postId, user.id));
    }
    return summary(post, user.id);
  }

  @GetMapping("/posts/{postId}/comments")
  @Transactional(readOnly = true)
  public List<HubComment> listComments(@PathVariable String postId, @AuthenticationPrincipal AuthUserEntity user) {
    visiblePost(postId, user);
    return comments.findByPostIdOrderByCreatedAtAscIdAsc(postId).stream()
      .map(this::comment)
      .toList();
  }

  @PostMapping("/posts/{postId}/comments")
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public HubComment createComment(
    @PathVariable String postId,
    @Valid @RequestBody NewComment input,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    visiblePost(postId, user);
    String body = input.body().trim();
    if (body.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment cannot be empty.");
    HubCommentEntity comment = new HubCommentEntity();
    comment.id = UUID.randomUUID().toString();
    comment.postId = postId;
    comment.authorId = user.id;
    comment.body = body;
    comment.createdAt = Instant.now();
    return comment(comments.save(comment));
  }

  private HubPostEntity visiblePost(String postId, AuthUserEntity user) {
    HubPostEntity post = posts.findById(postId)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found."));
    boolean canView = postAccess.read(post,user.id);
    if (!canView) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found in your feed.");
    return post;
  }

  private HubPostEntity ownedPost(String postId, AuthUserEntity user) {
    HubPostEntity post = posts.findById(postId)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found."));
    if (!post.authorId.equals(user.id)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only edit or delete your own posts.");
    }
    return post;
  }

  private HubPostView summary(HubPostEntity post,String viewerId){return presenter.view(post,viewerId);}

  private HubComment comment(HubCommentEntity entity) {
    AuthUserEntity author = users.findById(entity.authorId).orElse(null);
    String authorName = identity.name(author);
    return new HubComment(entity.id, entity.postId, authorName, author == null ? "unknown" : author.username, entity.body, entity.createdAt);
  }
}