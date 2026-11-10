package com.nightfall.messenger.channels;
import jakarta.persistence.*;
@Entity
@Table(name="channel_comment_reactions")
public class ChannelCommentReactionEntity {
  @Id @Column(length=120) public String id;
  @Column(nullable=false,length=36) public String channelId;
  @Column(nullable=false,length=36) public String postId;
  @Column(nullable=false,length=36) public String commentId;
  @Column(nullable=false,length=36) public String userId;
  @Column(nullable=false,length=16) public String emoji;
  protected ChannelCommentReactionEntity() {}
}
