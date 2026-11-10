package com.nightfall.messenger.channels;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "channel_posts", indexes = {
  @Index(name = "idx_channel_posts_channel_created", columnList = "channelId,createdAt")
})
public class ChannelPostEntity {
  @Id
  @Column(nullable = false, length = 36)
  public String id;

  @Column(nullable = false, length = 36)
  public String channelId;

  @Column(nullable = false, length = 36)
  public String authorId;

  @Column(nullable = false, length = 2000)
  public String body;

  @Column(length = 2048)
  public String link;

  @Column(length = 255)
  public String attachmentName;

  @Column(length = 120)
  public String attachmentType;

  @jakarta.persistence.Lob
  public String attachmentData;

  @Column(nullable = false)
  public Instant createdAt;

  @Column(nullable=false, columnDefinition="boolean default false")
  public boolean pinned = false;
  @Column(nullable=false, columnDefinition="boolean default true")
  public boolean commentsEnabled = true;
  public Instant editedAt;

  protected ChannelPostEntity() {}
}
