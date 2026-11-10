package com.nightfall.messenger.hub;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "hub_posts")
public class HubPostEntity {
  @Id
  @Column(nullable = false, length = 36)
  public String id;

  @Column(nullable = false, length = 36)
  public String authorId;

  @Column(name="wall_owner_id",length=36) public String wallOwnerId;
  @Column(length=8) public String audience="friends";

  @Column(nullable = false, length = 500)
  public String body;

  @Column(nullable = false)
  public Instant createdAt;

  protected HubPostEntity() {}
}