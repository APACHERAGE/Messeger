package com.nightfall.messenger.hub;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "hub_media")
public class HubMediaEntity {
  @Id @Column(length = 36) public String id;
  @Column(nullable = false, length = 36) public String postId;
  @Column(nullable = false, length = 255) public String name;
  @Column(name = "content_type", nullable = false, length = 40) public String type;
  @Column(name = "file_size", nullable = false) public long size;
  @Column(name = "media_order", nullable = false) public int ordinal;
  @Lob @Column(nullable = false) public byte[] data;

  protected HubMediaEntity() {}
}
