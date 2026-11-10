package com.nightfall.messenger.channels;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "channel_follows")
public class ChannelFollowEntity {
  @Id
  @Column(nullable = false, length = 73)
  public String id;

  @Column(nullable = false, length = 36)
  public String channelId;

  @Column(nullable = false, length = 36)
  public String userId;

  protected ChannelFollowEntity() {}

  public ChannelFollowEntity(String channelId, String userId) {
    this.id = channelId + ":" + userId;
    this.channelId = channelId;
    this.userId = userId;
  }
}
