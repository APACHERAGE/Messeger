package com.nightfall.messenger.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class ProfileVisibility {
  @Column(name = "visible_pronouns") public Boolean pronouns = true;
  @Column(name = "visible_company") public Boolean company = true;
  @Column(name = "visible_timezone") public Boolean timezone = true;
  @Column(name = "visible_interests") public Boolean interests = true;
  @Column(name = "visible_lookingfor") public Boolean lookingFor = true;
  @Column(name = "visible_githubusername") public Boolean githubUsername = true;
  @Column(name = "visible_avatar") public Boolean avatar = true;
  @Column(name = "visible_firstname") public Boolean firstName = true;
  @Column(name = "visible_lastname") public Boolean lastName = true;
  @Column(name = "visible_headline") public Boolean headline = true;
  @Column(name = "visible_bio") public Boolean bio = true;
  @Column(name = "visible_skills") public Boolean skills = true;
  @Column(name = "visible_location") public Boolean location = true;
  @Column(name = "visible_website") public Boolean website = true;
  @Column(name = "visible_githubprojects") public Boolean githubProjects = true;
  @Column(name = "visible_status") public Boolean status = true;
}
