package com.nightfall.messenger.discussions;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "discussion_comments", indexes = {
  @Index(name = "idx_discussion_comments_thread_created", columnList = "threadId,createdAt")
})
public class DiscussionCommentEntity {
  @Id
  @Column(nullable = false, length = 36)
  public String id;

  @Column(nullable = false, length = 36)
  public String threadId;

  @Column(length = 36)
  public String parentCommentId;

  @Column(nullable = false, length = 36)
  public String authorId;

  @Column(nullable = false, length = 2000)
  public String body;

  @Column(nullable = false)
  public Instant createdAt;

  protected DiscussionCommentEntity() {}
}
