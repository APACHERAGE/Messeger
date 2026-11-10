package com.nightfall.messenger.profile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
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
    @Size(max = 39) String githubUsername,
    @Size(max = 48) String displayName,
    @Size(max = 48) String firstName,
    @Size(max = 48) String lastName,
    @NotBlank @Pattern(regexp = "[A-Za-z0-9_]{3,24}") String username,
    @Size(max = 80) String headline,
    @Size(max = 240) String bio,
    @Size(max = 2000) String skills,
    @Size(max = 80) String location,
    @Size(max = 200) String website,
    @Size(max = 6) List<@Valid GitHubProjectUpdate> githubProjects,
    @Size(max = 60) String status,
    @Size(max = 1_000_000) String avatarDataUrl,
    boolean notifications,
    boolean showOnline,
    boolean compactMode,
    boolean showMessagePreview,
    boolean autoMarkRead,
    boolean sendOnEnter,
    boolean reduceMotion,
    boolean pixelGrid,
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

  @PutMapping
  @Transactional
  public ProfileEntity update(@Valid @RequestBody ProfileUpdate input, @AuthenticationPrincipal AuthUserEntity user) {
    ProfileEntity profile = get(user);
    String username = input.username().trim().toLowerCase(java.util.Locale.ROOT);
    if (!username.equalsIgnoreCase(user.username) && users.existsByUsernameIgnoreCase(username)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "This username is already taken.");
    }
    user.username = username;
    user.firstName = input.firstName() == null ? "" : input.firstName().trim();
    user.lastName = input.lastName() == null ? "" : input.lastName().trim();
    users.save(user);
    profile.pronouns = input.pronouns() == null ? "" : input.pronouns().trim();
    profile.company = input.company() == null ? "" : input.company().trim();
    profile.timezone = input.timezone() == null ? "" : input.timezone().trim();
    profile.interests = input.interests() == null ? "" : input.interests().trim();
    profile.lookingFor = input.lookingFor() == null ? "" : input.lookingFor().trim();
    profile.githubUsername = input.githubUsername() == null ? "" : input.githubUsername().trim();
    profile.displayName = input.displayName() == null ? "" : input.displayName().trim();
    profile.firstName = user.firstName;
    profile.lastName = user.lastName;
    profile.username = username;
    profile.headline = input.headline() == null ? "" : input.headline().trim();
    profile.bio = input.bio() == null ? "" : input.bio().trim();
    profile.skills = input.skills() == null ? "" : input.skills().trim();
    profile.location = input.location() == null ? "" : input.location().trim();
    profile.website = input.website() == null ? "" : input.website().trim();
    profile.githubProjects.clear();
    if (input.githubProjects() != null) profile.githubProjects.addAll(input.githubProjects().stream()
      .map(project -> new GitHubProjectEntity(project.name().trim(), project.url().trim(), project.description() == null ? "" : project.description().trim()))
      .toList());
    profile.status = input.status() == null ? "" : input.status().trim();
    profile.avatarDataUrl = input.avatarDataUrl() == null ? "" : input.avatarDataUrl();
    profile.notifications = input.notifications();
    profile.showOnline = input.showOnline();
    profile.compactMode = input.compactMode();
    profile.showMessagePreview = input.showMessagePreview();
    profile.autoMarkRead = input.autoMarkRead();
    profile.sendOnEnter = input.sendOnEnter();
    profile.reduceMotion = input.reduceMotion();
    profile.pixelGrid = input.pixelGrid();
    if (input.visibility() != null) profile.visibility = input.visibility();
    if (input.preferences() != null) profile.preferences = input.preferences();
    if (input.wallPostingAudience() != null) profile.wallPostingAudience = input.wallPostingAudience();
    if (input.profileAudience() != null) profile.profileAudience = input.profileAudience();
    if (input.messageAudience() != null) profile.messageAudience = input.messageAudience();
    return profiles.save(profile);
  }
}
