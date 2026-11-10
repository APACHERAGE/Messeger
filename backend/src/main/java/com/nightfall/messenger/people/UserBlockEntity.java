package com.nightfall.messenger.people;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_blocks")
public class UserBlockEntity {
  @Id public String id;
  public String ownerId;
  public String blockedUserId;

  protected UserBlockEntity() {}

  public UserBlockEntity(String ownerId, String blockedUserId) {
    this.id = ownerId + ":" + blockedUserId;
    this.ownerId = ownerId;
    this.blockedUserId = blockedUserId;
  }
}
