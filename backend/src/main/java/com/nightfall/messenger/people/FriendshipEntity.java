package com.nightfall.messenger.people;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "friendships")
public class FriendshipEntity {
  @Id @Column(length = 73) public String id;
  @Column(nullable = false, length = 36) public String requesterId;
  @Column(nullable = false, length = 36) public String recipientId;
  @Column(nullable = false, length = 12) public String status = "pending";
  @Column(nullable = false) public Instant createdAt = Instant.now();
  protected FriendshipEntity() {}
  public static String pair(String a, String b) { return a.compareTo(b) < 0 ? a + ":" + b : b + ":" + a; }
  public FriendshipEntity(String requester, String recipient) {
    id = pair(requester, recipient); requesterId = requester; recipientId = recipient;
  }
  public String other(String viewer) { return requesterId.equals(viewer) ? recipientId : requesterId; }
}
