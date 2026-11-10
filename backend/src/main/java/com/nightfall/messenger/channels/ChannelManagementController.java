package com.nightfall.messenger.channels;

import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import com.nightfall.messenger.profile.PublicIdentity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/channels/{channelId}")
public class ChannelManagementController {
  private final ChannelAccess access;
  private final ChannelRepository channels;
  private final ChannelPostRepository posts;
  private final ChannelFollowRepository follows;
  private final ChannelCommentRepository comments;
  private final ChannelCommentReactionRepository reactions;
  private final AuthUserRepository users;
  private final PublicIdentity identity;
  public ChannelManagementController(ChannelAccess access, ChannelRepository channels, ChannelPostRepository posts, ChannelFollowRepository follows, ChannelCommentRepository comments, ChannelCommentReactionRepository reactions, AuthUserRepository users, PublicIdentity identity) {
    this.access=access; this.channels=channels; this.posts=posts; this.follows=follows; this.comments=comments; this.reactions=reactions; this.users=users; this.identity=identity;
  }
  public record Settings(@NotBlank @Size(max=72) String title, @Size(max=240) String description, boolean commentsEnabled) {}
  public record Transfer(@NotBlank String newOwnerId) {}
  public record DeleteChannel(@NotBlank String confirmation) {}
  public record EditPost(@Size(max=2000) String body, Boolean pinned, Boolean commentsEnabled) {}
  public record Subscriber(String id, String name, String username) {}

  @PutMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void settings(@PathVariable String channelId, @Valid @RequestBody Settings input, @AuthenticationPrincipal AuthUserEntity user) {
    var channel=access.owned(channelId,user.id);
    channel.title=input.title().trim(); channel.description=input.description()==null?"":input.description().trim(); channel.commentsEnabled=input.commentsEnabled();
  }

  @GetMapping("/subscribers")
  @Transactional(readOnly=true)
  public List<Subscriber> subscribers(@PathVariable String channelId, @AuthenticationPrincipal AuthUserEntity user) {
    // This directory is deliberately owner-only.
    if (!access.read(channelId).ownerId.equals(user.id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the channel owner can view subscribers.");
    return follows.findByChannelId(channelId).stream().map(f -> users.findById(f.userId).orElse(null)).filter(u -> u!=null).map(u -> new Subscriber(u.id,identity.name(u),u.username)).toList();
  }

  @PostMapping("/transfer")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void transfer(@PathVariable String channelId, @Valid @RequestBody Transfer input, @AuthenticationPrincipal AuthUserEntity user) {
    var channel=access.owned(channelId,user.id);
    if (user.id.equals(input.newOwnerId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose another subscriber.");
    if (!users.existsById(input.newOwnerId()) || !follows.existsById(channelId+":"+input.newOwnerId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The new owner must already follow this channel.");
    channel.ownerId=input.newOwnerId();
    follows.deleteByIdAndUserId(channelId+":"+user.id,user.id);
  }

  @DeleteMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void delete(@PathVariable String channelId, @Valid @RequestBody DeleteChannel input, @AuthenticationPrincipal AuthUserEntity user) {
    var channel=access.owned(channelId,user.id);
    if (!channel.title.equals(input.confirmation())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Type the channel name to confirm deletion.");
    reactions.deleteByChannelId(channelId); comments.deleteByChannelId(channelId); posts.deleteByChannelId(channelId); follows.deleteByChannelId(channelId); channels.delete(channel);
  }

  @PatchMapping("/posts/{postId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void edit(@PathVariable String channelId, @PathVariable String postId, @Valid @RequestBody EditPost input, @AuthenticationPrincipal AuthUserEntity user) {
    access.owned(channelId,user.id); var post=access.post(channelId,postId);
    if(input.body()!=null) {
      String body=input.body().trim();
      if(body.isEmpty() && post.link==null && post.attachmentData==null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A post cannot be empty.");
      post.body=body; post.editedAt=Instant.now();
    }
    if(input.pinned()!=null) post.pinned=input.pinned();
    if(input.commentsEnabled()!=null) post.commentsEnabled=input.commentsEnabled();
  }

  @DeleteMapping("/posts/{postId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void deletePost(@PathVariable String channelId, @PathVariable String postId, @AuthenticationPrincipal AuthUserEntity user) {
    access.owned(channelId,user.id); var post=access.post(channelId,postId);
    reactions.deleteByPostId(postId); comments.deleteByPostId(postId); posts.delete(post);
  }
}
