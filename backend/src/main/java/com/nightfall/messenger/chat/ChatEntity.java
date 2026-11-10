package com.nightfall.messenger.chat;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

@Entity
@Table(name = "chats", indexes = {
  @Index(name = "idx_chats_owner", columnList = "ownerId"),
  @Index(name = "idx_chats_peer", columnList = "peerId")
})
public class ChatEntity {
  @Id public String id;
  public String ownerId;
  public String name;
  public String handle;
  public String avatar;
  public String accent;
  public String lastMessage;
  public String time;
  public java.time.Instant updatedAt = java.time.Instant.now();
  public int unread;
  public boolean online;
  public String kind;
  public String peerId;
  public boolean pinned;

  protected ChatEntity() {}

  public ChatEntity(String id, String name, String avatar, String accent, String kind) {
    this.id = id;
    this.name = name;
    this.avatar = avatar;
    this.accent = accent;
    this.kind = kind;
    this.lastMessage = "Say hello";
    this.time = "now";
  }
}
