package com.nightfall.messenger.profile;

import com.nightfall.messenger.auth.AuthUserEntity;
import org.springframework.stereotype.Service;

/** Shared display-name policy: hidden name fields must not reappear as author fallbacks. */
@Service
public class PublicIdentity {
  private final ProfileRepository profiles;

  public PublicIdentity(ProfileRepository profiles) { this.profiles = profiles; }

  public String name(AuthUserEntity user) {
    if (user == null) return "Deleted user";
    ProfileEntity profile = profiles.findById(user.id).orElse(null);
    if (profile != null && !profile.displayName.isBlank()) return profile.displayName.trim();
    if (profile != null) return user.username;
    String fullName = (user.firstName + " " + user.lastName).trim();
    return fullName.isEmpty() ? user.username : fullName;
  }
}
