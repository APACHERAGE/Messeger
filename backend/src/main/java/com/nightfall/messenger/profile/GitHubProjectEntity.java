package com.nightfall.messenger.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class GitHubProjectEntity {
  @Column(length = 80) public String name;
  @Column(length = 200) public String url;
  @Column(length = 160) public String description;

  protected GitHubProjectEntity() {}

  public GitHubProjectEntity(String name, String url, String description) {
    this.name = name;
    this.url = url;
    this.description = description;
  }
}
