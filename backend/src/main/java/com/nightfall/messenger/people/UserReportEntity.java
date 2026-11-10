package com.nightfall.messenger.people;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_reports")
public class UserReportEntity {
  @Id public String id;
  public String reporterId;
  public String reportedUserId;
  @Column(nullable = false, length = 500) public String reason;
  public long createdAt;

  protected UserReportEntity() {}

  public UserReportEntity(String reporterId, String reportedUserId, String reason) {
    this.id = java.util.UUID.randomUUID().toString();
    this.reporterId = reporterId;
    this.reportedUserId = reportedUserId;
    this.reason = reason;
    this.createdAt = System.currentTimeMillis();
  }
}
