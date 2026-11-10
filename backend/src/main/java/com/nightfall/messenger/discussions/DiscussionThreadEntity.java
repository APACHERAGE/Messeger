package com.nightfall.messenger.discussions;

import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "discussion_threads", indexes = {
  @Index(name = "idx_discussion_threads_created", columnList = "createdAt"),
  @Index(name = "idx_discussion_threads_author", columnList = "authorId")
})
public class DiscussionThreadEntity {
  @Id
  @Column(nullable = false, length = 36)
  public String id;

  @Column(nullable = false, length = 140)
  public String title;

  @Column(nullable = false, length = 5000)
  public String body;

  @ElementCollection
  @CollectionTable(name = "discussion_thread_tags", joinColumns = @JoinColumn(name = "thread_id"))
  @Column(name = "tag", nullable = false, length = 32)
  @OrderColumn(name = "tag_order")
  public List<String> tags = new ArrayList<>();

  @Column(nullable = false)
  public boolean resolved;

  @Column(length = 36)
  public String acceptedAnswerId;

  @Column(nullable = false, length = 36)
  public String authorId;

  @Column(nullable = false)
  public Instant createdAt;

  @Column(nullable = false)
  public Instant updatedAt;

  protected DiscussionThreadEntity() {}
}
