package com.nightfall.messenger.mail;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "mail_messages", indexes = {
  @Index(name = "idx_mail_messages_recipient", columnList = "recipientId,sentAt"),
  @Index(name = "idx_mail_messages_sender", columnList = "senderId,sentAt")
})
public class MailMessageEntity {
  @Id
  @Column(nullable = false, length = 36)
  public String id;

  @Column(nullable = false, length = 36)
  public String senderId;

  @Column(nullable = false, length = 36)
  public String recipientId;

  @Column(nullable = false, length = 31)
  public String senderAddress;

  @Column(nullable = false, length = 31)
  public String recipientAddress;

  @Column(nullable = false, length = 100)
  public String senderName;

  @Column(nullable = false, length = 100)
  public String recipientName;

  @Column(nullable = false, length = 160)
  public String subject;

  @Lob
  @Column(nullable = false)
  public String body;

  @Column(nullable = false)
  public Instant sentAt;

  protected MailMessageEntity() {}
}
