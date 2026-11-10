package com.nightfall.messenger.people;

import com.nightfall.messenger.profile.ProfileEntity;
import com.nightfall.messenger.profile.ProfileRepository;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/** One access policy shared by directory cards, walls, attachments, and direct messages. */
@Service
public class SocialAccess {
  private final FriendshipRepository friends;
  private final UserBlockRepository blocks;
  private final ProfileRepository profiles;
  public SocialAccess(FriendshipRepository friends, UserBlockRepository blocks, ProfileRepository profiles) {
    this.friends = friends; this.blocks = blocks; this.profiles = profiles;
  }
  public boolean blocked(String a, String b) {
    return blocks.existsByOwnerIdAndBlockedUserId(a,b) || blocks.existsByOwnerIdAndBlockedUserId(b,a);
  }
  public String relationship(String viewer, String target) {
    if (viewer.equals(target) || blocked(viewer,target)) return "none";
    return friends.findById(FriendshipEntity.pair(viewer,target)).map(friend -> "accepted".equals(friend.status) ? "friends"
      : friend.requesterId.equals(viewer) ? "outgoing" : "incoming").orElse("none");
  }
  public boolean friends(String a, String b) { return "friends".equals(relationship(a,b)); }
  public Set<String> friendIds(String viewer) {
    return friends.findByRequesterIdOrRecipientId(viewer,viewer).stream().filter(friend -> "accepted".equals(friend.status))
      .map(friend -> friend.other(viewer)).filter(other -> !blocked(viewer,other)).collect(Collectors.toSet());
  }
  private boolean audience(String audience, String owner, String viewer) {
    if (owner.equals(viewer)) return true;
    if (blocked(owner,viewer)) return false;
    return audience == null || "everyone".equals(audience) || ("friends".equals(audience) && friends(owner,viewer));
  }
  public boolean profile(String owner, String viewer) {
    ProfileEntity profile = profiles.findById(owner).orElse(null);
    return audience(profile == null ? "everyone" : profile.profileAudience,owner,viewer);
  }
  public boolean message(String owner, String viewer) {
    ProfileEntity profile = profiles.findById(owner).orElse(null);
    return audience(profile == null ? "everyone" : profile.messageAudience,owner,viewer);
  }
  public boolean postToWall(String owner,String viewer) {
    if(owner.equals(viewer)) return true;
    if(!friends(owner,viewer)) return false;
    ProfileEntity profile=profiles.findById(owner).orElse(null);
    return profile==null || !"nobody".equals(profile.wallPostingAudience);
  }
  public boolean wall(String owner, String viewer) { return owner.equals(viewer) || friends(owner,viewer); }
}
