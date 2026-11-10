package com.nightfall.messenger.people;
import jakarta.persistence.*;
@Entity @Table(name="people_follows")
public class FollowEntity {
 @Id @Column(length=73) public String id;
 @Column(nullable=false,length=36) public String userId;
 @Column(nullable=false,length=36) public String targetUserId;
 protected FollowEntity(){}
 public FollowEntity(String user,String target){id=user+":"+target;userId=user;targetUserId=target;}
}
