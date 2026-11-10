package com.nightfall.messenger.channels;

import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelFollowRepository extends JpaRepository<ChannelFollowEntity, String> {
  List<ChannelFollowEntity> findByUserId(String userId);
  List<ChannelFollowEntity> findByUserId(String userId, Pageable pageable);
  List<ChannelFollowEntity> findByChannelId(String channelId);
  List<ChannelFollowEntity> findByChannelId(String channelId, Pageable pageable);
  void deleteByChannelId(String channelId);
  long countByChannelId(String channelId);
  void deleteByIdAndUserId(String id, String userId);

  @org.springframework.data.jpa.repository.Query(
    "select follow.channelId as channelId, count(follow) as total from ChannelFollowEntity follow where follow.channelId in :channelIds group by follow.channelId")
  List<FollowerCount> countByChannelIds(@org.springframework.data.repository.query.Param("channelIds") Collection<String> channelIds);

  interface FollowerCount {
    String getChannelId();
    long getTotal();
  }

  default void saveIfAbsent(String id, String channelId, String userId) {
    if (!existsById(id)) save(new ChannelFollowEntity(channelId, userId));
  }
}
