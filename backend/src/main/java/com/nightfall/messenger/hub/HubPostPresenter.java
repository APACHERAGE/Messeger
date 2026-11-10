package com.nightfall.messenger.hub;
import com.nightfall.messenger.auth.AuthUserRepository;
import com.nightfall.messenger.profile.PublicIdentity;
import org.springframework.stereotype.Service;
@Service
public class HubPostPresenter {
  private final AuthUserRepository users;
  private final PublicIdentity identity;
  private final HubMediaRepository media;
  private final HubCommentRepository comments;
  private final HubReactionRepository reactions;
  private final HubAccess access;
  public HubPostPresenter(AuthUserRepository users,PublicIdentity identity,HubMediaRepository media,HubCommentRepository comments,HubReactionRepository reactions,HubAccess access){
    this.users=users;this.identity=identity;this.media=media;this.comments=comments;this.reactions=reactions;this.access=access;
  }
  public HubPostView view(HubPostEntity post,String viewer){
    var author=users.findById(post.authorId).orElse(null);
    String owner=access.owner(post);
    return new HubPostView(post.id,post.authorId,identity.name(author),author==null?"unknown":author.username,post.createdAt,post.body,
      reactions.countByPostId(post.id),comments.countByPostId(post.id),reactions.existsByPostIdAndUserId(post.id,viewer),"cyan",
      media.findAllByPostIdOrderByOrdinalAsc(post.id).stream().map(item->new HubPostView.Attachment(item.getId(),item.getName(),item.getType(),item.getSize())).toList(),
      owner,identity.name(users.findById(owner).orElse(null)),"public".equals(post.audience)?"public":"friends",viewer.equals(post.authorId),access.delete(post,viewer));
  }
}
