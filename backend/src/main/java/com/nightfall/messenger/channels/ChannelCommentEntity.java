package com.nightfall.messenger.channels;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="channel_comments", indexes=@Index(name="idx_channel_comments_post", columnList="postId,createdAt"))
public class ChannelCommentEntity {
  @Id @Column(length=36) public String id;
  @Column(nullable=false,length=36) public String channelId;
  @Column(nullable=false,length=36) public String postId;
  @Column(nullable=false,length=36) public String authorId;
  @Column(length=36) public String parentId;
  @Column(nullable=false,length=2000) public String body="";
  public Instant createdAt;
  public boolean removed;
  public String photoType;
  @Lob public byte[] photo;
  protected ChannelCommentEntity() {}
}
