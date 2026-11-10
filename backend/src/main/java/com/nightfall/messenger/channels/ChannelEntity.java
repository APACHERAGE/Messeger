package com.nightfall.messenger.channels;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(name = "channels", uniqueConstraints = {
  @UniqueConstraint(name = "uk_channels_handle", columnNames = "handle")
})
public class ChannelEntity {
  @Id
  @Column(nullable = false, length = 36)
  public String id;

  @Column(nullable = false, length = 72)
  public String title;

  @Column(nullable = false, length = 48)
  public String handle;

  @Column(nullable = false, length = 240)
  public String description = "";

  @Column(nullable = false, length = 36)
  public String ownerId;

  @Column(nullable = false)
  public Instant createdAt;

  @Column(nullable=false, columnDefinition="boolean default true")
  public boolean commentsEnabled = true;

  protected ChannelEntity() {}
}
