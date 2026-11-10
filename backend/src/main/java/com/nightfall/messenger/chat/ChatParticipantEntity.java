package com.nightfall.messenger.chat;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "chat_participants")
public class ChatParticipantEntity {
  @Id public String id;
  public String chatId;
  public String userId;
  public long lastReadAt;

  protected ChatParticipantEntity() {}

  public ChatParticipantEntity(String chatId, String userId) {
    this.id = chatId + ":" + userId;
    this.chatId = chatId;
    this.userId = userId;
    this.lastReadAt = System.currentTimeMillis();
  }
}
