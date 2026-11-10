package com.nightfall.messenger.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "messages", indexes = {
  @Index(name = "idx_messages_chat_created", columnList = "chatId,createdAt"),
  @Index(name = "idx_messages_chat_sender_created", columnList = "chatId,senderId,createdAt")
})
public class MessageEntity {
  @Id public String id;
  public String chatId;
  public String senderId;
  public String author;
  public String avatar;
  @Column(length = 4000) public String text;
  @Column(length = 255) public String attachmentName;
  @Column(length = 120) public String attachmentType;
  @Lob public String attachmentData;
  @Column(name = "display_time") public String time;
  public long createdAt;
  public boolean own;
  public boolean edited;

  protected MessageEntity() {}

  public MessageEntity(String id, String chatId, String author, String avatar, String text, String time, boolean own) {
    this.id = id;
    this.chatId = chatId;
    this.author = author;
    this.avatar = avatar;
    this.text = text;
    this.time = time;
    this.own = own;
    this.createdAt = System.currentTimeMillis();
  }
}
