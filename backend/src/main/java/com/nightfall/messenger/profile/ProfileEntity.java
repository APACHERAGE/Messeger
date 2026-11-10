package com.nightfall.messenger.profile;

import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Embedded;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "profiles")
public class ProfileEntity {
  @Id public String id = "local";
  @Column(length = 40) public String pronouns = "";
  @Column(length = 80) public String company = "";
  @Column(length = 60) public String timezone = "";
  @Column(length = 240) public String interests = "";
  @Column(length = 160) public String lookingFor = "";
  @Column(length = 39) public String githubUsername = "";
  @Column(length = 48) public String displayName = "Nightwalker";
  @Column(length = 48) public String firstName = "";
  @Column(length = 48) public String lastName = "";
  @Column(length = 24) public String username = "nightwalker";
  @Column(length = 80) public String headline = "Developer";
  @Column(length = 240) public String bio = "Building after-hours worlds and shipping good vibes.";
  @Column(length = 2000) public String skills = "";
  @Column(length = 80) public String location = "";
  @Column(length = 200) public String website = "";
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "profile_github_projects", joinColumns = @JoinColumn(name = "profile_id"))
  @OrderColumn(name = "project_order")
  public List<GitHubProjectEntity> githubProjects = new ArrayList<>();
  @Column(length = 60) public String status = "Available";
  @Lob public String avatarDataUrl = "";
  @jakarta.validation.constraints.Pattern(regexp = "everyone|friends|nobody")
  @Column(length = 12) public String profileAudience = "everyone";
  @jakarta.validation.constraints.Pattern(regexp = "friends|nobody")
  @Column(length = 12) public String wallPostingAudience = "friends";
  @jakarta.validation.constraints.Pattern(regexp = "everyone|friends|nobody")
  @Column(length = 12) public String messageAudience = "everyone";
  public boolean notifications = true;
  public boolean showOnline = true;
  public boolean compactMode = false;
  public boolean showMessagePreview = true;
  public boolean autoMarkRead = true;
  public boolean sendOnEnter = true;
  public boolean reduceMotion = false;
  public boolean pixelGrid = true;

  @Embedded public ProfileVisibility visibility = new ProfileVisibility();
  @Embedded public ProfilePreferences preferences = new ProfilePreferences();

  public boolean visible(String field) {
    if (visibility == null) return true;
    return !Boolean.FALSE.equals(switch (field) {
      case "pronouns" -> visibility.pronouns;
      case "company" -> visibility.company;
      case "timezone" -> visibility.timezone;
      case "interests" -> visibility.interests;
      case "lookingFor" -> visibility.lookingFor;
      case "githubUsername" -> visibility.githubUsername;
      case "avatar" -> visibility.avatar;
      case "firstName" -> visibility.firstName;
      case "lastName" -> visibility.lastName;
      case "headline" -> visibility.headline;
      case "bio" -> visibility.bio;
      case "skills" -> visibility.skills;
      case "location" -> visibility.location;
      case "website" -> visibility.website;
      case "githubProjects" -> visibility.githubProjects;
      case "status" -> visibility.status;
      default -> false;
    });
  }

  protected ProfileEntity() {}
}
