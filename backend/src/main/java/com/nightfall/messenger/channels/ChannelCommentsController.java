package com.nightfall.messenger.channels;

import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import com.nightfall.messenger.profile.PublicIdentity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.*;
import java.nio.charset.StandardCharsets;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/channels/{channelId}/posts/{postId}/comments")
public class ChannelCommentsController {
  private static final Set<String> EMOJI=Set.of("👍","❤️","😂","🔥","🎉","👀");
  private final ChannelAccess access;
  private final ChannelCommentRepository comments;
  private final ChannelCommentReactionRepository reactions;
  private final AuthUserRepository users;
  private final PublicIdentity identity;
  public ChannelCommentsController(ChannelAccess access, ChannelCommentRepository comments, ChannelCommentReactionRepository reactions, AuthUserRepository users, PublicIdentity identity) {
    this.access=access; this.comments=comments; this.reactions=reactions; this.users=users; this.identity=identity;
  }
  public record NewComment(@Size(max=2000) String body, @Size(max=36) String parentId, @Size(max=1_400_000) String photoData) {}
  public record React(@Size(max=16) String emoji) {}
  public record Reaction(String emoji,long count,boolean mine) {}
  public record Comment(String id,String authorId,String author,String username,String body,String parentId,String parentAuthor,String parentBody,Instant createdAt,boolean removed,String photoUrl,List<Reaction> reactions,boolean canDelete) {}
  public record CommentPage(List<Comment> items,boolean hasMore,int nextPage,long total) {}

  @GetMapping
  @Transactional(readOnly=true)
  public CommentPage list(@PathVariable String channelId,@PathVariable String postId,@RequestParam(defaultValue="0") int page,@AuthenticationPrincipal AuthUserEntity user) {
    var channel=access.read(channelId); access.post(channelId,postId);
    if(page<0||page>10000) throw bad("Invalid comments page.");
    var result=comments.findByPostIdOrderByCreatedAtAscIdAsc(postId,PageRequest.of(page,50));
    return new CommentPage(result.stream().map(c -> view(c,user.id,channel.ownerId)).toList(),result.hasNext(),page+1,comments.countByPostIdAndRemovedFalse(postId));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public Comment add(@PathVariable String channelId,@PathVariable String postId,@Valid @RequestBody NewComment input,@AuthenticationPrincipal AuthUserEntity user) {
    var channel=access.lock(channelId); var post=access.post(channelId,postId);
    if(!channel.commentsEnabled||!post.commentsEnabled) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Comments are closed for this post.");
    String body=input.body()==null?"":input.body().trim();
    if(body.isEmpty()&&(input.photoData()==null||input.photoData().isBlank())) throw bad("Write a comment or add a photo.");
    if(input.parentId()!=null) {
      var parent=find(channelId,postId,input.parentId());
      if(parent.removed) throw bad("This comment has been removed. Reply to the post instead.");
    }
    var comment=new ChannelCommentEntity(); comment.id=UUID.randomUUID().toString(); comment.channelId=channelId; comment.postId=postId; comment.authorId=user.id; comment.body=body; comment.parentId=input.parentId(); comment.createdAt=Instant.now();
    if(input.photoData()!=null) photo(comment,input.photoData());
    return view(comments.save(comment),user.id,channel.ownerId);
  }

  @DeleteMapping("/{commentId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void delete(@PathVariable String channelId,@PathVariable String postId,@PathVariable String commentId,@AuthenticationPrincipal AuthUserEntity user) {
    var channel=access.lock(channelId); access.post(channelId,postId); var c=find(channelId,postId,commentId);
    if(!c.authorId.equals(user.id)&&!channel.ownerId.equals(user.id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the author or channel owner can remove this comment.");
    // Keep a tombstone so replies retain their context; remove text, image and reactions.
    c.removed=true; c.body=""; c.photo=null; c.photoType=null; reactions.deleteByCommentId(commentId);
  }

  @PostMapping("/{commentId}/reactions")
  @Transactional
  public Comment react(@PathVariable String channelId,@PathVariable String postId,@PathVariable String commentId,@Valid @RequestBody React input,@AuthenticationPrincipal AuthUserEntity user) {
    var channel=access.lock(channelId); access.post(channelId,postId); var c=find(channelId,postId,commentId);
    if(c.removed||input.emoji()==null||!EMOJI.contains(input.emoji())) throw bad("Choose a supported reaction on an existing comment.");
    String id=commentId+":"+user.id+":"+input.emoji();
    if(reactions.existsById(id)) reactions.deleteById(id);
    else { var r=new ChannelCommentReactionEntity(); r.id=id; r.channelId=channelId; r.postId=postId; r.commentId=commentId; r.userId=user.id; r.emoji=input.emoji(); reactions.save(r); }
    reactions.flush();
    return view(c,user.id,channel.ownerId);
  }

  @GetMapping("/{commentId}/photo")
  @Transactional(readOnly=true)
  public ResponseEntity<byte[]> photo(@PathVariable String channelId,@PathVariable String postId,@PathVariable String commentId) {
    access.read(channelId); access.post(channelId,postId); var c=find(channelId,postId,commentId);
    if(c.removed||c.photo==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Photo not found.");
    return ResponseEntity.ok().contentType(MediaType.parseMediaType(c.photoType)).header("X-Content-Type-Options","nosniff").header("Content-Disposition","inline").cacheControl(CacheControl.noStore()).body(c.photo);
  }

  private ChannelCommentEntity find(String channelId,String postId,String id) {
    return comments.findById(id).filter(c -> c.channelId.equals(channelId)&&c.postId.equals(postId)).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Comment not found in this post."));
  }
  private Comment view(ChannelCommentEntity c,String viewer,String owner) {
    var author=users.findById(c.authorId).orElse(null);
    var parent=c.parentId==null?null:comments.findById(c.parentId).orElse(null);
    String parentAuthor=parent==null?null:identity.name(users.findById(parent.authorId).orElse(null));
    var all=reactions.findByCommentId(c.id);
    List<Reaction> counts=EMOJI.stream().sorted().filter(e -> all.stream().anyMatch(r -> r.emoji.equals(e))).map(e -> new Reaction(e,all.stream().filter(r -> r.emoji.equals(e)).count(),all.stream().anyMatch(r -> r.emoji.equals(e)&&r.userId.equals(viewer)))).toList();
    return new Comment(c.id,c.authorId,identity.name(author),author==null?"deleted":author.username,c.removed?"":c.body,c.parentId,parentAuthor,parent==null?null:parent.removed?"Comment removed":parent.body.substring(0,Math.min(parent.body.length(),160)),c.createdAt,c.removed,c.removed||c.photo==null?null:"/api/channels/"+c.channelId+"/posts/"+c.postId+"/comments/"+c.id+"/photo",counts,!c.removed&&(c.authorId.equals(viewer)||owner.equals(viewer)));
  }
  private static void photo(ChannelCommentEntity c,String data) {
    var match=java.util.regex.Pattern.compile("^data:(image/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$").matcher(data);
    if(!match.matches()) throw bad("Choose a PNG, JPG, GIF or WebP photo (up to 1 MB).");
    byte[] bytes;
    try { bytes=Base64.getDecoder().decode(match.group(2)); } catch(IllegalArgumentException e) { throw bad("Invalid photo data."); }
    if(bytes.length==0||bytes.length>1_000_000) throw bad("Photos must be smaller than 1 MB.");
    String type=match.group(1); String ascii=new String(bytes,0,Math.min(12,bytes.length),StandardCharsets.ISO_8859_1);
    boolean valid=switch(type) {
      case "image/png" -> bytes.length>=8&&(bytes[0]&255)==137&&ascii.substring(1,8).equals("PNG\r\n\u001a\n");
      case "image/jpeg" -> bytes.length>=3&&(bytes[0]&255)==255&&(bytes[1]&255)==216&&(bytes[2]&255)==255;
      case "image/gif" -> ascii.startsWith("GIF87a")||ascii.startsWith("GIF89a");
      case "image/webp" -> ascii.startsWith("RIFF")&&ascii.length()>=12&&ascii.substring(8,12).equals("WEBP");
      default -> false;
    };
    if(!valid) throw bad("Photo content does not match its type.");
    c.photoType=type; c.photo=bytes;
  }
  private static ResponseStatusException bad(String text) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,text); }
}
