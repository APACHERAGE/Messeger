package com.nightfall.messenger.people;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "contacts")
public class ContactEntity {
  @Id public String id;
  public String ownerId;
  public String personId;
  protected ContactEntity() {}
  public ContactEntity(String ownerId, String personId) {
    this.id = ownerId + ":" + personId;
    this.ownerId = ownerId;
    this.personId = personId;
  }
}
