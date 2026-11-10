package com.nightfall.messenger.people;

import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import com.nightfall.messenger.profile.ProfileEntity;
import com.nightfall.messenger.profile.ProfileRepository;
import com.nightfall.messenger.profile.PublicIdentity;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PeopleService {
  public record GitHubProject(String name, String url, String description) {}
  public record Person(String id, String displayName, String username, String email, String phone, String avatar,
    String accent, boolean online, String headline, String skills, List<GitHubProject> githubProjects,
    String firstName, String lastName, String bio, String location, String website, String status, String avatarDataUrl,
    boolean canViewProfile, boolean canMessage, boolean canViewWall, String relationship, boolean canPostToWall,
    String pronouns,String company,String timezone,String interests,String lookingFor,String githubUsername,PublicAppearance appearance,boolean isFollowing) {}
  public record PublicAppearance(String coverStyle,String profileDensity,String artMode,String artId,Boolean showDecorations) {}
  private final FollowRepository follows;
  private final AuthUserRepository users;
  private final ProfileRepository profiles;
  private final PublicIdentity identity;
  private final SocialAccess access;
  public PeopleService(AuthUserRepository users, ProfileRepository profiles, PublicIdentity identity, SocialAccess access,FollowRepository follows) {
    this.follows=follows;
    this.users=users; this.profiles=profiles; this.identity=identity; this.access=access;
  }
  public Person get(String id, AuthUserEntity viewer) {
    return person(users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Account not found.")),viewer);
  }
  public Person person(AuthUserEntity account, AuthUserEntity viewer) {
    ProfileEntity stored=profiles.findById(account.id).orElse(null);
    boolean allowed=access.profile(account.id,viewer.id);
    ProfileEntity p=allowed ? stored : null;
    String name=identity.name(account);
    return new Person(account.id,name,account.username,"","",name.substring(0,1).toUpperCase(Locale.ROOT),"green",false,
      field(p,"headline",p==null?"":p.headline),field(p,"skills",p==null?"":p.skills),
      p==null || !p.visible("githubProjects") ? List.of() : p.githubProjects.stream().map(project -> new GitHubProject(project.name,project.url,project.description)).toList(),
      field(p,"firstName",p==null?"":p.firstName),field(p,"lastName",p==null?"":p.lastName),field(p,"bio",p==null?"":p.bio),
      field(p,"location",p==null?"":p.location),field(p,"website",p==null?"":p.website),
      p!=null && p.showOnline ? field(p,"status",p.status):"",field(p,"avatar",p==null?"":p.avatarDataUrl),
      allowed,access.message(account.id,viewer.id),access.wall(account.id,viewer.id),access.relationship(viewer.id,account.id),access.postToWall(account.id,viewer.id),
      field(p,"pronouns",p==null?"":p.pronouns),field(p,"company",p==null?"":p.company),field(p,"timezone",p==null?"":p.timezone),
      field(p,"interests",p==null?"":p.interests),field(p,"lookingFor",p==null?"":p.lookingFor),field(p,"githubUsername",p==null?"":p.githubUsername),
      p==null||p.preferences==null?null:new PublicAppearance(p.preferences.coverStyle,p.preferences.profileDensity,p.preferences.artMode,p.preferences.artId,p.preferences.showDecorations),follows.existsById(viewer.id+":"+account.id)&&!access.blocked(viewer.id,account.id));
  }
  private String field(ProfileEntity p,String name,String value) { return p!=null && p.visible(name)?value:""; }
}
