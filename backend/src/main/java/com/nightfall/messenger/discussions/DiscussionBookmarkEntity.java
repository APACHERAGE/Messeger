package com.nightfall.messenger.discussions;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "discussion_bookmarks", uniqueConstraints = {
  @UniqueConstraint(name = "uk_discussion_bookmark_user_thread", columnNames = {"user_id", "thread_id"})
})
public class DiscussionBookmarkEntity {
  @Id
  @Column(nullable = false, length = 36)
  public String id;

  @Column(name = "user_id", nullable = false, length = 36)
  public String userId;

  @Column(name = "thread_id", nullable = false, length = 36)
  public String threadId;

  protected DiscussionBookmarkEntity() {}
}
