package com.nightfall.messenger.channels;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ChannelAccess {
  private final ChannelRepository channels;
  private final ChannelPostRepository posts;
  public ChannelAccess(ChannelRepository channels, ChannelPostRepository posts) { this.channels=channels; this.posts=posts; }
  public ChannelEntity read(String id) { return channels.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found.")); }
  // Serialize ownership changes, deletion, publishing and moderation on the same channel row.
  public ChannelEntity lock(String id) { return channels.findLockedById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found.")); }
  public ChannelEntity owned(String id, String userId) {
    var channel=lock(id);
    if (!channel.ownerId.equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the channel owner can do this.");
    return channel;
  }
  public ChannelPostEntity post(String channelId, String postId) {
    return posts.findById(postId).filter(p -> p.channelId.equals(channelId)).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found in this channel."));
  }
}
