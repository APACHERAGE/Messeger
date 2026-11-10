package com.nightfall.messenger.profile;

import com.nightfall.messenger.media.DataUrlAttachment;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
  private final ProfileRepository profiles;
  private final AuthUserRepository users;

  public ProfileController(ProfileRepository profiles, AuthUserRepository users) {
    this.profiles = profiles;
    this.users = users;
  }

  public record ProfileUpdate(
    @Size(max = 40) String pronouns,
    @Size(max = 80) String company,
    @Size(max = 60) String timezone,
    @Size(max = 240) String interests,
    @Size(max = 160) String lookingFor,
    @Pattern(regexp = "^$|[A-Za-z0-9-]{1,39}$") String githubUsername,
    @Size(max = 48) String displayName,
    @Size(max = 48) String firstName,
    @Size(max = 48) String lastName,
    @Pattern(regexp = "[A-Za-z0-9_]{3,24}") String username,
    @Size(max = 80) String headline,
    @Size(max = 240) String bio,
    @Size(max = 2000) String skills,
    @Size(max = 80) String location,
    @Pattern(regexp = "^$|https?://\\S+$") @Size(max = 200) String website,
    @Size(max = 6) List<@Valid GitHubProjectUpdate> githubProjects,
    @Size(max = 60) String status,
    @Size(max = 1_400_000) String avatarDataUrl,
    Boolean notifications,
    Boolean showOnline,
    Boolean compactMode,
    Boolean showMessagePreview,
    Boolean autoMarkRead,
    Boolean sendOnEnter,
    Boolean reduceMotion,
    Boolean pixelGrid,
    @Valid ProfileVisibility visibility,
    @Valid ProfilePreferences preferences,
    @Pattern(regexp = "everyone|friends|nobody") String profileAudience,
    @Pattern(regexp = "everyone|friends|nobody") String messageAudience,
    @Pattern(regexp = "friends|nobody") String wallPostingAudience
  ) {}
  public record GitHubProjectUpdate(
    @NotBlank @Size(max = 80) String name,
    @NotBlank @Pattern(regexp = "https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?") String url,
    @Size(max = 160) String description
  ) {}

  @GetMapping
  public ProfileEntity get(@AuthenticationPrincipal AuthUserEntity user) {
    return profiles.findById(user.id).orElseGet(() -> {
      ProfileEntity profile = new ProfileEntity();
      profile.id = user.id;
      profile.displayName = (user.firstName + " " + user.lastName).trim();
      profile.firstName = user.firstName;
      profile.lastName = user.lastName;
      profile.username = user.username;
      return profiles.save(profile);
    });
  }

  /**
   * A null field means "keep the current value", so a partial PUT can never
   * silently wipe a profile. An explicit empty string still clears a field.
   */
  @PutMapping
  @Transactional
  public ProfileEntity update(@Valid @RequestBody ProfileUpdate input, @AuthenticationPrincipal AuthUserEntity user) {
    ProfileEntity profile = get(user);
    if (input.username() != null) {
      String username = input.username().trim().toLowerCase(Locale.ROOT);
      if (!username.equalsIgnoreCase(user.username) && users.existsByUsernameIgnoreCase(username)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "This username is already taken.");
      }
      user.username = username;
      profile.username = username;
    }
    if (input.firstName() != null) user.firstName = input.firstName().trim();
    if (input.lastName() != null) user.lastName = input.lastName().trim();
    users.save(user);
    if (input.pronouns() != null) profile.pronouns = input.pronouns().trim();
    if (input.company() != null) profile.company = input.company().trim();
    if (input.timezone() != null) profile.timezone = input.timezone().trim();
    if (input.interests() != null) profile.interests = input.interests().trim();
    if (input.lookingFor() != null) profile.lookingFor = input.lookingFor().trim();
    if (input.githubUsername() != null) profile.githubUsername = input.githubUsername().trim();
    if (input.displayName() != null) profile.displayName = input.displayName().trim();
    profile.firstName = user.firstName;
    profile.lastName = user.lastName;
    if (input.headline() != null) profile.headline = input.headline().trim();
    if (input.bio() != null) profile.bio = input.bio().trim();
    if (input.skills() != null) profile.skills = input.skills().trim();
    if (input.location() != null) profile.location = input.location().trim();
    if (input.website() != null) profile.website = input.website().trim();
    if (input.githubProjects() != null) {
      profile.githubProjects.clear();
      profile.githubProjects.addAll(input.githubProjects().stream()
        .map(project -> new GitHubProjectEntity(project.name().trim(), project.url().trim(), project.description() == null ? "" : project.description().trim()))
        .toList());
    }
    if (input.status() != null) profile.status = input.status().trim();
    if (input.avatarDataUrl() != null) profile.avatarDataUrl = validateAvatar(input.avatarDataUrl());
    if (input.notifications() != null) profile.notifications = input.notifications();
    if (input.showOnline() != null) profile.showOnline = input.showOnline();
    if (input.compactMode() != null) profile.compactMode = input.compactMode();
    if (input.showMessagePreview() != null) profile.showMessagePreview = input.showMessagePreview();
    if (input.autoMarkRead() != null) profile.autoMarkRead = input.autoMarkRead();
    if (input.sendOnEnter() != null) profile.sendOnEnter = input.sendOnEnter();
    if (input.reduceMotion() != null) profile.reduceMotion = input.reduceMotion();
    if (input.pixelGrid() != null) profile.pixelGrid = input.pixelGrid();
    if (input.visibility() != null) profile.visibility = input.visibility();
    if (input.preferences() != null) profile.preferences = input.preferences();
    if (input.wallPostingAudience() != null) profile.wallPostingAudience = input.wallPostingAudience();
    if (input.profileAudience() != null) profile.profileAudience = input.profileAudience();
    if (input.messageAudience() != null) profile.messageAudience = input.messageAudience();
    return profiles.save(profile);
  }

  private static String validateAvatar(String raw) {
    String value = raw == null ? "" : raw.trim();
    if (value.isEmpty()) return "";
    try {
      return DataUrlAttachment.parse("avatar", null, value, 1_000_000, DataUrlAttachment.AVATAR_TYPES).dataUrl();
    } catch (ResponseStatusException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
        "Avatar must be a PNG, JPEG, GIF, or WebP image under 1 MB.", exception);
    }
  }
}
