package com.nightfall.messenger.hub;
import com.nightfall.messenger.people.SocialAccess;
import org.springframework.stereotype.Service;
@Service
public class HubAccess {
  private final SocialAccess social;
  public HubAccess(SocialAccess social){this.social=social;}
  public String owner(HubPostEntity post){return post.wallOwnerId==null?post.authorId:post.wallOwnerId;}
  public boolean read(HubPostEntity post,String viewer){
    if(viewer.equals(post.authorId)||viewer.equals(owner(post)))return true;
    if(social.blocked(post.authorId,viewer)||social.blocked(owner(post),viewer))return false;
    return "public".equals(post.audience)||social.wall(owner(post),viewer);
  }
  public boolean delete(HubPostEntity post,String viewer){return viewer.equals(post.authorId)||viewer.equals(owner(post));}
}
