package com.nightfall.messenger.hub;
import java.time.Instant;
import java.util.List;
public record HubPostView(String id,String authorId,String author,String username,Instant createdAt,String body,long likes,long comments,
  boolean liked,String accent,List<Attachment> attachments,String wallOwnerId,String wallOwnerName,String audience,boolean canEdit,boolean canDelete) {
  public record Attachment(String id,String name,String type,long size) {}
}
