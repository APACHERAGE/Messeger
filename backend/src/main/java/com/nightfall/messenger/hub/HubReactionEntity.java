package com.nightfall.messenger.hub;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "hub_reactions")
public class HubReactionEntity {
  @Id
  @Column(nullable = false, length = 73)
  public String id;

  @Column(nullable = false, length = 36)
  public String postId;

  @Column(nullable = false, length = 36)
  public String userId;

  protected HubReactionEntity() {}

  public HubReactionEntity(String postId, String userId) {
    this.id = postId + ":" + userId;
    this.postId = postId;
    this.userId = userId;
  }
}