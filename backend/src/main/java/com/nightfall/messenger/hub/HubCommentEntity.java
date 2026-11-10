package com.nightfall.messenger.hub;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "hub_comments")
public class HubCommentEntity {
  @Id
  @Column(nullable = false, length = 36)
  public String id;

  @Column(nullable = false, length = 36)
  public String postId;

  @Column(nullable = false, length = 36)
  public String authorId;

  @Column(nullable = false, length = 1000)
  public String body;

  @Column(nullable = false)
  public Instant createdAt;

  protected HubCommentEntity() {}
}